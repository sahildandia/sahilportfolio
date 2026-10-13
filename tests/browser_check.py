#!/usr/bin/env python3
"""Verify the static portfolio against a running local HTTP server.

Requires Playwright and Chromium. Run from any directory:
    python3 tests/browser_check.py
    PORTFOLIO_BASE_URL=http://127.0.0.1:8000 python3 tests/browser_check.py
Optional screenshots are saved outside the checkout with --screenshots DIR.
"""

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urljoin, urlsplit
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
EMAIL = "dandiasahil@gmail.com"
SOURCE_URLS = {
    "movie": "https://github.com/sahildandia/Movie-Ticket-Booking-System",
    "currency": "https://github.com/sahildandia/currency-exchange-rate-calculator-",
}
ROUTES = {
    "about.html": "about",
    "projects.html": "work",
    "experience.html": "experience",
    "contact.html": "contact",
}

# Prevent an OS mail application from opening, while preserving the actual
# form submit handler and the draft link it creates. Count real GPU draw calls
# independently of the scene's diagnostics.
BROWSER_PROBE = """
window.__portfolioDrawCalls = 0;
for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
  const prototype = window[name]?.prototype;
  if (!prototype) continue;
  for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
    const original = prototype[method];
    if (typeof original !== 'function') continue;
    prototype[method] = function(...args) {
      window.__portfolioDrawCalls++;
      return original.apply(this, args);
    };
  }
}
document.addEventListener('click', event => {
  if (event.target.closest('a[href^="mailto:"]')) event.preventDefault();
}, true);
"""
NO_WEBGL = """
const original = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function(type, ...args) {
  if (/^(webgl2?|experimental-webgl)$/.test(type)) return null;
  return original.call(this, type, ...args);
};
"""


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.refs = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        for key in ("href", "src"):
            if attrs.get(key):
                self.refs.append(attrs[key])


def check_http_and_links(base):
    """Check referenced real files, not just existence of a server process."""
    parsers = {}
    checked = set()
    for page in ROOT.glob("*.html"):
        parser = References()
        parser.feed(page.read_text())
        parsers[page.name] = parser
        assert len(parser.ids) == len(set(parser.ids)), f"Duplicate IDs: {page.name}"
        with urlopen(urljoin(base, page.name), timeout=10) as response:
            assert response.status == 200
        for ref in parser.refs:
            parsed = urlsplit(ref)
            if parsed.scheme or parsed.netloc:
                continue
            if parsed.path:
                asset = ROOT / unquote(parsed.path)
                assert asset.is_file(), f"Missing {page.name} asset: {ref}"
                if parsed.path not in checked:
                    checked.add(parsed.path)
                    with urlopen(urljoin(base, quote(unquote(parsed.path))), timeout=10) as response:
                        assert response.status == 200, ref
            elif parsed.fragment:
                assert parsed.fragment in parser.ids, f"Missing anchor: {ref}"
        print(f"PASS HTTP, unique IDs, local assets and anchors: {page.name}", flush=True)
    for name, parser in parsers.items():
        for ref in parser.refs:
            parsed = urlsplit(ref)
            if parsed.path in parsers and parsed.fragment:
                assert parsed.fragment in parsers[parsed.path].ids, f"Broken route: {name}: {ref}"


class BrowserErrors:
    def __init__(self, base):
        self.origin = urlsplit(base).netloc
        self.errors = []

    def watch(self, page, label):
        page.on("pageerror", lambda error: self.errors.append(f"{label} runtime: {error}"))
        page.on("console", lambda message: self.errors.append(f"{label} console: {message.text}")
                if message.type == "error" else None)
        page.on("requestfailed", lambda request: self.errors.append(
            f"{label} request failed: {request.url}: {request.failure}")
            if urlsplit(request.url).netloc == self.origin
            and request.failure != "net::ERR_ABORTED" else None)
        page.on("response", lambda response: self.errors.append(
            f"{label} HTTP {response.status}: {response.url}")
            if urlsplit(response.url).netloc == self.origin and response.status >= 400 else None)

    def assert_clean(self):
        assert not self.errors, "\n".join(self.errors)


def wait_ready(page):
    expect(page.locator("#hero-scene")).to_have_attribute("data-scene-state", "ready", timeout=30000)
    page.wait_for_function("window.__portfolioDrawCalls > 0")
    assert page.locator("#hero-canvas").evaluate("canvas => canvas.width > 0 && canvas.height > 0")


def diagnostics(page):
    return page.locator("#hero-scene").evaluate("host => host.sceneDiagnostics")


def wait_motion_settled(page):
    # Allow queued observer/render work to finish before testing a stopped loop.
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")


def assert_no_overflow(page, label):
    dimensions = page.evaluate("({scroll: document.documentElement.scrollWidth, viewport: innerWidth})")
    assert dimensions["scroll"] <= dimensions["viewport"], f"{label}: {dimensions}"


def verify_main_browser(browser, base, errors, screenshots):
    context = browser.new_context(viewport={"width": 1440, "height": 1000},
                                  permissions=["clipboard-read", "clipboard-write"])
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "desktop")
    page.goto(base, wait_until="domcontentloaded")
    wait_ready(page)
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    assert page.locator("#home .hero-buttons a").count() == 3
    assert page.get_by_role("link", name="View Projects", exact=True).get_attribute("href") == "#work"
    assert page.get_by_role("link", name="Contact Me").get_attribute("href") == "#contact"

    # Keyboard pause/resume controls stop actual rendering, not just a label.
    pause = page.locator("#scene-motion")
    pause.focus()
    page.keyboard.press("Enter")
    expect(pause).to_have_attribute("aria-pressed", "true")
    wait_motion_settled(page)
    before = diagnostics(page)
    draws = page.evaluate("window.__portfolioDrawCalls")
    page.wait_for_timeout(160)
    assert diagnostics(page)["frameCount"] == before["frameCount"]
    assert page.evaluate("window.__portfolioDrawCalls") == draws
    assert not diagnostics(page)["running"]
    page.keyboard.press("Space")
    expect(pause).to_have_attribute("aria-pressed", "false")
    page.wait_for_function("previous => document.querySelector('#hero-scene').sceneDiagnostics.frameCount > previous",
                           arg=before["frameCount"])
    bounds = page.locator("#hero-scene").bounding_box()
    page.mouse.move(bounds["x"] + bounds["width"] * .8, bounds["y"] + bounds["height"] * .3)
    page.wait_for_function("Math.abs(document.querySelector('#hero-scene').sceneDiagnostics.pointerTarget.x) > .3")
    before_rotation = diagnostics(page)["rotation"]
    page.wait_for_function("previous => { const value = document.querySelector('#hero-scene').sceneDiagnostics.rotation; return Math.abs(value.x - previous.x) + Math.abs(value.y - previous.y) > .002; }", arg=before_rotation)
    print("PASS WebGL draw calls, pointer rotation and keyboard pause/resume", flush=True)

    for width in (320, 375, 390, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 1000})
        page.wait_for_timeout(80)
        assert_no_overflow(page, f"Width {width}")
    print("PASS responsive widths 320, 375, 390, 768, 1024, 1440", flush=True)
    if screenshots:
        page.screenshot(path=str(screenshots / "desktop.png"))

    page.locator("#about").scroll_into_view_if_needed()
    expect(page.locator("#about .portrait")).to_be_visible()
    page.wait_for_function("document.querySelector('#about .portrait').complete && document.querySelector('#about .portrait').naturalWidth > 0")
    page.wait_for_function("!document.querySelector('#hero-scene').sceneDiagnostics.visible")
    wait_motion_settled(page)
    frames = diagnostics(page)["frameCount"]
    page.wait_for_timeout(160)
    assert diagnostics(page)["frameCount"] == frames
    assert not diagnostics(page)["running"]
    print("PASS recognizable loaded portrait and offscreen rendering suspension", flush=True)

    for category in ("web", "ai", "data", "all"):
        page.locator(f'[data-filter="{category}"]').click()
        expected_count = 3 if category == "all" else 1
        expect(page.locator(".project-card:visible")).to_have_count(expected_count)
        assert page.locator(f'[data-filter="{category}"]').get_attribute("aria-pressed") == "true"
        assert str(expected_count) in page.locator("#filter-status").inner_text()
    for key in ("fall", "movie", "currency"):
        trigger = page.locator(f'[data-project="{key}"]').first
        trigger.focus()
        page.keyboard.press("Enter")
        expect(page.locator("#project-dialog")).to_be_visible()
        assert page.locator("#dialog-points li").count() >= 3
        if key in SOURCE_URLS:
            assert page.locator("#dialog-source").get_attribute("href") == SOURCE_URLS[key]
            expect(page.locator("#dialog-source")).to_be_visible()
        else:
            expect(page.locator("#dialog-source")).to_be_hidden()
            assert page.locator("#dialog-source-note a").get_attribute("href").startswith("mailto:" + EMAIL)
        page.keyboard.press("Escape")
        expect(page.locator("#project-dialog")).to_be_hidden()
        expect(trigger).to_be_focused()
    for url in SOURCE_URLS.values():
        assert page.locator(f'.project-card a[href="{url}"]').count() == 1
    print("PASS project filtering, preserved source links, keyboard dialogs and focus return", flush=True)

    theme = page.locator("#theme-toggle")
    theme.click()
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    page.reload(wait_until="domcontentloaded")
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    page.locator("#theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    with page.expect_download() as download_info:
        page.get_by_role("link", name="Download Resume").click()
    download = download_info.value
    assert download.suggested_filename == "Sahil-Kumar-Resume.docx"
    assert Path(download.path()).read_bytes() == (ROOT / "assets/Sahil-Kumar-Resume.docx").read_bytes()
    print("PASS theme persistence and exact original résumé download", flush=True)

    page.locator("#copy-email").click()
    assert page.evaluate("navigator.clipboard.readText()") == EMAIL
    submit = page.locator("#contact-form button[type=submit]")
    submit.click()
    assert not page.locator("#contact-name").evaluate("input => input.validity.valid")
    visitor_name = "Alex & Sam + Café"
    message = "Discuss a project? Budget: ₹1,000 & feedback + details.\nThank you!"
    visitor_email = "visitor+portfolio@example.com"
    page.locator("#contact-name").fill(visitor_name)
    page.locator("#contact-email").fill("invalid")
    page.locator("#contact-message").fill(message)
    assert not page.locator("#contact-form").evaluate("form => form.checkValidity()")
    page.locator("#contact-email").fill(visitor_email)
    submit.click()
    expect(page.locator("#email-draft")).to_be_visible()
    draft = urlsplit(page.locator("#email-draft").get_attribute("href"))
    assert draft.scheme == "mailto" and draft.path == EMAIL
    query = parse_qs(draft.query)
    assert query["subject"] == ["Portfolio enquiry from " + visitor_name]
    assert query["body"] == [f"Hi Sahil,\n\n{message}\n\nFrom: {visitor_name}\nEmail: {visitor_email}"]
    assert "email draft is ready" in page.locator("#form-status").inner_text()
    assert page.locator('a[href="tel:+917051381035"]').count() == 1
    assert page.locator('a[href="https://linkedin.com/in/sahildandia"]').count() == 1
    print("PASS clipboard, contact validation, encoded email draft and contact links", flush=True)

    for filename, section in ROUTES.items():
        page.goto(urljoin(base, filename), wait_until="domcontentloaded")
        page.wait_for_function("section => location.hash === '#' + section", arg=section)
        expect(page.locator("#" + section)).to_be_in_viewport()
        assert_no_overflow(page, filename)
    page.goto(urljoin(base, "index.html#skills"), wait_until="domcontentloaded")
    expect(page.locator("#skills")).to_be_in_viewport()
    print("PASS all original entry routes and new skills anchor", flush=True)
    errors.assert_clean()
    context.close()


def verify_mobile(browser, base, errors, screenshots):
    context = browser.new_context(viewport={"width": 375, "height": 812},
                                  device_scale_factor=3, has_touch=True, is_mobile=True)
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "mobile")
    page.goto(base, wait_until="domcontentloaded")
    page.locator("#hero-scene").scroll_into_view_if_needed()
    wait_ready(page)
    assert_no_overflow(page, "Touch mobile")
    ratio = page.locator("#hero-canvas").evaluate("canvas => canvas.width / canvas.getBoundingClientRect().width")
    assert ratio <= 1.35, f"Mobile pixel ratio not capped: {ratio}"
    assert page.locator("#hero-canvas").evaluate("canvas => getComputedStyle(canvas).touchAction") != "none"
    before = diagnostics(page)["pointerTarget"]
    page.locator("#hero-scene").dispatch_event("pointermove", {"pointerType": "touch", "clientX": 300, "clientY": 100})
    assert diagnostics(page)["pointerTarget"] == before
    page.locator("#menu-toggle").tap()
    expect(page.locator("#main-nav")).to_be_visible()
    page.locator('#main-nav a[href="#skills"]').tap()
    expect(page.locator("#menu-toggle")).to_have_attribute("aria-expanded", "false")
    assert page.evaluate("location.hash") == "#skills"
    page.locator("#menu-toggle").focus()
    page.keyboard.press("Enter")
    page.keyboard.press("Escape")
    expect(page.locator("#menu-toggle")).to_be_focused()
    expect(page.locator("#menu-toggle")).to_have_attribute("aria-expanded", "false")
    page.locator('[data-filter="web"]').tap()
    expect(page.locator(".project-card:visible")).to_have_count(1)
    page.locator('[data-filter="all"]').tap()
    if screenshots:
        page.goto(base, wait_until="domcontentloaded")
        # Viewport captures avoid Chromium GPU tile limits for a very tall
        # page at DPR 3, and make the intended mobile layout easy to inspect.
        page.screenshot(path=str(screenshots / "mobile.png"), scale="css")
        for section in ("hero-scene", "work", "about"):
            page.locator("#" + section).scroll_into_view_if_needed()
            page.screenshot(path=str(screenshots / f"mobile-{section}.png"), scale="css",
                            animations="disabled")
    print("PASS touch navigation, native scrolling, mobile render budget and filters", flush=True)
    errors.assert_clean()
    context.close()


def verify_reduced_motion_and_fallback(browser, base, errors):
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "reduced motion")
    page.goto(base, wait_until="domcontentloaded")
    wait_ready(page)
    expect(page.locator("#scene-motion")).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#scene-motion")).to_be_disabled()
    wait_motion_settled(page)
    before = diagnostics(page)
    draws = page.evaluate("window.__portfolioDrawCalls")
    page.locator("#hero-scene").dispatch_event("pointermove", {"pointerType": "mouse", "clientX": 1100, "clientY": 400})
    page.wait_for_timeout(160)
    assert diagnostics(page)["frameCount"] == before["frameCount"]
    assert diagnostics(page)["rotation"] == before["rotation"]
    assert page.evaluate("window.__portfolioDrawCalls") == draws
    assert diagnostics(page)["reducedMotion"] and not diagnostics(page)["running"]
    assert page.locator("#work .reveal").first.evaluate("element => getComputedStyle(element).opacity") == "1"
    assert page.locator("html").evaluate("element => getComputedStyle(element).scrollBehavior") == "auto"
    page.emulate_media(reduced_motion="no-preference")
    expect(page.locator("#scene-motion")).to_be_enabled()
    page.wait_for_function("document.querySelector('#hero-scene').sceneDiagnostics.running")
    page.emulate_media(reduced_motion="reduce")
    expect(page.locator("#scene-motion")).to_be_disabled()
    print("PASS reduced-motion static rendering and live preference changes", flush=True)
    context.close()

    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.add_init_script(NO_WEBGL)
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "no WebGL")
    page.goto(base, wait_until="domcontentloaded")
    expect(page.locator("#hero-scene")).to_have_attribute("data-scene-state", "fallback")
    expect(page.locator("#scene-fallback")).to_be_visible()
    expect(page.locator("#scene-motion")).to_be_hidden()
    expect(page.get_by_role("link", name="View Projects", exact=True)).to_be_visible()
    expect(page.get_by_role("link", name="Download Resume")).to_be_visible()
    assert page.evaluate("window.__portfolioDrawCalls") == 0
    page.locator('[data-filter="ai"]').click()
    expect(page.locator(".project-card:visible")).to_have_count(1)
    page.locator("#about").scroll_into_view_if_needed()
    expect(page.locator("#about .portrait")).to_be_visible()
    print("PASS attractive WebGL fallback with working content and controls", flush=True)
    errors.assert_clean()
    context.close()


def main():
    import os

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--screenshots", type=Path, help="Optional screenshot directory outside the checkout")
    args = parser.parse_args()
    screenshots = args.screenshots.resolve() if args.screenshots else None
    if screenshots:
        if screenshots == ROOT or ROOT in screenshots.parents:
            parser.error("Save screenshots outside the checkout")
        screenshots.mkdir(parents=True, exist_ok=True)
    base = os.environ.get("PORTFOLIO_BASE_URL", "http://127.0.0.1:8000").rstrip("/") + "/"
    check_http_and_links(base)
    errors = BrowserErrors(base)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", headless=True,
                                              args=["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"])
        verify_main_browser(browser, base, errors, screenshots)
        verify_mobile(browser, base, errors, screenshots)
        verify_reduced_motion_and_fallback(browser, base, errors)
        errors.assert_clean()
        browser.close()
    print("PASS no browser runtime errors, console errors or failed local assets", flush=True)


if __name__ == "__main__":
    main()
