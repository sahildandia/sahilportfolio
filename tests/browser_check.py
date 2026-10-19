#!/usr/bin/env python3
"""Verify the static portfolio against a running local HTTP server.

Requires Playwright and Chromium. Run from any directory:
    python3 tests/browser_check.py
    PORTFOLIO_BASE_URL=http://127.0.0.1:8000 python3 tests/browser_check.py
Optional screenshots are saved outside the checkout with --screenshots DIR.
"""

import argparse
import base64
import copy
import json
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urljoin, urlsplit
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
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
        relative_page = page.relative_to(ROOT).as_posix()
        parsers[relative_page] = parser
        assert len(parser.ids) == len(set(parser.ids)), f"Duplicate IDs: {page.name}"
        with urlopen(urljoin(base, relative_page), timeout=10) as response:
            assert response.status == 200
        for ref in parser.refs:
            parsed = urlsplit(ref)
            if parsed.scheme or parsed.netloc:
                continue
            if parsed.path:
                asset = (page.parent / unquote(parsed.path)).resolve()
                if asset.is_dir():
                    asset = asset / "index.html"
                assert asset.is_file(), f"Missing {page.name} asset: {ref}"
                if parsed.path not in checked:
                    checked.add(parsed.path)
                    with urlopen(urljoin(urljoin(base, relative_page), quote(unquote(parsed.path))), timeout=10) as response:
                        assert response.status == 200, ref
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


def wait_public_ready(page):
    expect(page.locator("body")).to_have_attribute("data-ready", "true", timeout=15000)


def open_public(page, base, suffix=""):
    page.goto(urljoin(base, suffix), wait_until="domcontentloaded")
    wait_public_ready(page)


def verify_public(browser, base, errors, screenshots):
    context = browser.new_context(viewport={"width": 1440, "height": 1000},
                                  permissions=["clipboard-read", "clipboard-write"])
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "public")
    open_public(page, base)
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    assert page.get_by_role("link", name="View Projects", exact=True).get_attribute("href") == "#work"
    assert page.get_by_role("link", name="Contact Me").get_attribute("href") == "#contact"
    portrait = page.locator("#home .portrait")
    expect(portrait).to_be_visible()
    page.wait_for_function("document.querySelector('#home .portrait').complete && document.querySelector('#home .portrait').naturalWidth > 0")
    invalid_anchors = page.evaluate("""() => [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href')).filter(href => href.length > 1 && !document.getElementById(href.slice(1)))""")
    assert not invalid_anchors, f"Missing public anchors: {invalid_anchors}"
    for section in ("home", "about", "skills", "work", "experience", "certificates", "contact"):
        expect(page.locator("#" + section)).to_have_count(1)
    print("PASS ivory theme, profile portrait, all sections, anchors and hero actions", flush=True)

    for width in (320, 375, 390, 768, 1024, 1440):
        page.set_viewport_size({"width": width, "height": 1000})
        page.wait_for_timeout(80)
        assert_no_overflow(page, f"Public width {width}")
    if screenshots:
        page.screenshot(path=str(screenshots / "desktop.png"), animations="disabled")
    print("PASS responsive widths 320, 375, 390, 768, 1024, 1440", flush=True)

    # Verify filtering against source content rather than fixed display counts.
    content = json.loads((ROOT / "assets/content.json").read_text())
    for category in ("mobile", "web", "ai", "data", "all"):
        page.locator(f'[data-filter="{category}"]').click()
        count = sum(category == "all" or item["category"] == category for item in content["projects"])
        expect(page.locator(".project-card:visible")).to_have_count(count)
        expect(page.locator(f'[data-filter="{category}"]')).to_have_attribute("aria-pressed", "true")
    for project in content["projects"]:
        trigger = page.locator(f'[data-project="{project["id"]}"]').first
        trigger.focus()
        page.keyboard.press("Enter")
        expect(page.locator("#project-dialog")).to_be_visible()
        expect(page.locator("#dialog-title")).to_have_text(project["title"])
        expect(page.locator("#dialog-points li")).to_have_count(len(project["details"]))
        if project["source"]:
            assert page.locator("#dialog-source").get_attribute("href") == project["source"]
            expect(page.locator("#dialog-source")).to_be_visible()
        else:
            expect(page.locator("#dialog-source")).to_be_hidden()
        if project.get("download"):
            expect(page.locator("#dialog-download")).to_be_visible()
            expect(page.locator("#dialog-download")).to_have_attribute("href", project["download"])
        else:
            expect(page.locator("#dialog-download")).to_be_hidden()
        page.keyboard.press("Escape")
        expect(page.locator("#project-dialog")).to_be_hidden()
        # Native <dialog> dispatches its close event after closing; let its
        # focus-return handler finish before activating the next project.
        wait_motion_settled(page)
        expect(trigger).to_be_focused()
    print("PASS data-driven project filters, details, source destinations and keyboard focus", flush=True)

    verify_skills(page, content)
    theme = page.locator("#theme-toggle")
    theme.click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.reload(wait_until="domcontentloaded")
    wait_public_ready(page)
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    page.locator("#theme-toggle").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "light")
    with page.expect_download() as download_info:
        page.get_by_role("link", name="Download Resume").first.click()
    download = download_info.value
    assert Path(download.path()).read_bytes() == (ROOT / content["profile"]["resume"]).read_bytes()
    assert download.suggested_filename.endswith(".docx")
    print("PASS light/dark theme persistence and exact supplied résumé download", flush=True)

    page.locator("#copy-email").click()
    assert page.evaluate("navigator.clipboard.readText()") == content["profile"]["email"]
    submit = page.locator("#contact-form button[type=submit]")
    submit.click()
    assert not page.locator("#contact-name").evaluate("input => input.validity.valid")
    name = "Alex & Sam + Café"
    message = "Discuss a project? Budget: ₹1,000 & feedback + details.\nThank you!"
    email = "visitor+portfolio@example.com"
    page.locator("#contact-name").fill(name)
    page.locator("#contact-email").fill("invalid")
    page.locator("#contact-message").fill(message)
    assert not page.locator("#contact-form").evaluate("form => form.checkValidity()")
    page.locator("#contact-email").fill(email)
    page.locator("#contact-subject").fill("Project & collaboration + review")
    submit.click()
    expect(page.locator("#email-draft")).to_be_visible()
    draft = urlsplit(page.locator("#email-draft").get_attribute("href"))
    assert draft.scheme == "mailto" and draft.path == content["profile"]["email"]
    query = parse_qs(draft.query)
    assert query["subject"] == ["Project & collaboration + review"]
    assert message in query["body"][0] and name in query["body"][0] and email in query["body"][0]
    assert page.locator(f'a[href="tel:{content["profile"]["phone"]}"]').count() >= 1
    assert page.locator(f'a[href="{content["profile"]["linkedin"]}"]').count() >= 1
    print("PASS clipboard, form validation, subject/Unicode email drafts and contact links", flush=True)

    for filename, section in ROUTES.items():
        open_public(page, base, filename)
        page.wait_for_function("section => location.hash === '#' + section", arg=section)
        expect(page.locator("#" + section)).to_be_in_viewport()
        assert_no_overflow(page, filename)
    for section in ("skills", "certificates"):
        open_public(page, base, "index.html#" + section)
        expect(page.locator("#" + section)).to_be_in_viewport()
    print("PASS original entry routes plus skills and certificate anchors", flush=True)
    verify_optional_scene(page)
    errors.assert_clean()
    context.close()


def verify_skills(page, content):
    search = page.locator("#skill-search")
    search.fill("opencv")
    visible = page.locator("#skills .skill-card:visible, #skills tbody tr:visible")
    expect(visible).to_have_count(1)
    expect(visible).to_contain_text("OpenCV")
    search.fill("does-not-exist")
    expect(visible).to_have_count(0)
    search.fill("")
    expect(visible).to_have_count(len(content["skills"]))
    for category in sorted({skill["category"] for skill in content["skills"]}):
        page.locator(f'[data-skill-filter="{category}"]').click()
        expect(visible).to_have_count(sum(skill["category"] == category for skill in content["skills"]))
    page.locator('[data-skill-filter="all"]').click()
    expect(visible).to_have_count(len(content["skills"]))
    print("PASS searchable skills, category filters and empty results", flush=True)


def open_scene(page):
    if page.locator(".scene-study").count() and not page.locator(".scene-study").evaluate("element => element.open"):
        page.locator(".scene-study summary").click()
    page.locator("#hero-scene").scroll_into_view_if_needed()


def verify_optional_scene(page):
    if not page.locator("#hero-scene").count():
        return
    open_scene(page)
    wait_ready(page)
    pause = page.locator("#scene-motion")
    pause.focus()
    page.keyboard.press("Enter")
    expect(pause).to_have_attribute("aria-pressed", "true")
    wait_motion_settled(page)
    frames = diagnostics(page)["frameCount"]
    page.wait_for_timeout(160)
    assert diagnostics(page)["frameCount"] == frames
    assert not diagnostics(page)["running"]
    page.keyboard.press("Space")
    page.wait_for_function("previous => document.querySelector('#hero-scene').sceneDiagnostics.frameCount > previous", arg=frames)
    page.locator("#contact").scroll_into_view_if_needed()
    page.wait_for_function("!document.querySelector('#hero-scene').sceneDiagnostics.visible")
    print("PASS retained 3D rendering, keyboard pause and offscreen suspension", flush=True)


def verify_mobile_and_motion(browser, base, errors, screenshots):
    context = browser.new_context(viewport={"width": 375, "height": 812},
                                  device_scale_factor=3, has_touch=True, is_mobile=True)
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "mobile")
    open_public(page, base)
    assert_no_overflow(page, "Mobile")
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
        open_public(page, base)
        page.screenshot(path=str(screenshots / "mobile.png"), scale="css", animations="disabled")
        for section in ("skills", "work", "contact"):
            page.locator("#" + section).scroll_into_view_if_needed()
            page.screenshot(path=str(screenshots / f"mobile-{section}.png"), scale="css", animations="disabled")
    print("PASS mobile touch navigation, keyboard menu and project filters", flush=True)
    errors.assert_clean()
    context.close()

    context = browser.new_context(viewport={"width": 1440, "height": 1000}, reduced_motion="reduce")
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "reduced motion")
    open_public(page, base)
    assert page.locator("html").evaluate("element => getComputedStyle(element).scrollBehavior") == "auto"
    if page.locator("#hero-scene").count():
        open_scene(page)
        wait_ready(page)
        expect(page.locator("#scene-motion")).to_be_disabled()
        wait_motion_settled(page)
        before = diagnostics(page)
        page.wait_for_timeout(160)
        assert diagnostics(page)["frameCount"] == before["frameCount"]
        assert diagnostics(page)["rotation"] == before["rotation"]
        assert diagnostics(page)["reducedMotion"] and not diagnostics(page)["running"]
    print("PASS reduced-motion scrolling and static 3D presentation", flush=True)
    context.close()

    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    context.add_init_script(NO_WEBGL)
    context.add_init_script(BROWSER_PROBE)
    page = context.new_page()
    errors.watch(page, "no WebGL")
    open_public(page, base)
    if page.locator("#hero-scene").count():
        open_scene(page)
        expect(page.locator("#hero-scene")).to_have_attribute("data-scene-state", "fallback")
        expect(page.locator("#scene-fallback")).to_be_visible()
    assert page.evaluate("window.__portfolioDrawCalls") == 0
    page.locator('[data-filter="ai"]').click()
    expect(page.locator(".project-card:visible")).to_have_count(1)
    page.locator("#home").scroll_into_view_if_needed()
    expect(page.locator("#home .portrait")).to_be_visible()
    print("PASS no-WebGL fallback with working portrait, projects and content", flush=True)
    errors.assert_clean()
    context.close()


class MockGitHub:
    """A local browser fixture; no real GitHub write is performed."""

    token = "fixture-volatile-admin-token-123"

    def __init__(self):
        self.content = json.loads((ROOT / "assets/content.json").read_text())
        self.sha = "a" * 40
        self.metadata_status = 200
        self.put_status = 200
        self.push_permission = True
        self.put_attempts = []
        self.successes = []
        self.auth_ok = True

    def handle(self, route):
        request = route.request
        parsed = urlsplit(request.url)
        cors = {"access-control-allow-origin": "*", "access-control-allow-methods": "GET, PUT, OPTIONS",
                "access-control-allow-headers": "authorization, content-type, accept, x-github-api-version"}
        if request.method == "OPTIONS":
            route.fulfill(status=204, headers=cors)
            return
        self.auth_ok = self.auth_ok and request.headers.get("authorization") == "Bearer " + self.token
        status = 200
        if parsed.path == "/repos/sahildandia/sahilportfolio":
            status = self.metadata_status
            data = {"default_branch": "master", "permissions": {"push": self.push_permission}}
        elif parsed.path == "/repos/sahildandia/sahilportfolio/contents/assets/content.json":
            if request.method == "GET":
                data = {"type": "file", "encoding": "base64", "sha": self.sha,
                        "content": base64.b64encode(json.dumps(self.content, ensure_ascii=False).encode()).decode()}
            elif request.method == "PUT":
                body = json.loads(request.post_data)
                decoded = json.loads(base64.b64decode(body["content"]).decode("utf-8"))
                self.put_attempts.append({"body": body, "decoded": decoded})
                status = self.put_status
                if status == 200:
                    assert body["sha"] == self.sha, "Publishing must use the current file SHA"
                    assert body["branch"] == "master"
                    assert body["message"]
                    self.content = decoded
                    self.sha = "c" * 40
                    self.successes.append(decoded)
                    data = {"content": {"sha": self.sha}, "commit": {"html_url": "https://github.com/sahildandia/sahilportfolio/commit/fixture"}}
                else:
                    data = {}
            else:
                raise AssertionError(f"Unexpected GitHub method: {request.method}")
        else:
            raise AssertionError(f"Unexpected GitHub endpoint: {parsed.path}")
        if status >= 400:
            data = {"message": {401: "Bad credentials", 403: "Resource not accessible by personal access token", 409: "SHA does not match"}[status]}
        route.fulfill(status=status, json=data, headers=cors)


def assert_no_token_persistence(page, token):
    storage = page.evaluate("JSON.stringify({local: {...localStorage}, session: {...sessionStorage}})")
    assert token not in storage, "Authentication token must not be persisted"
    assert token not in page.url, "Authentication token must not appear in the URL"
    assert token not in page.content(), "Authentication token must not be embedded in HTML"


def connect_admin(page, fixture):
    if page.locator("#logout-button").is_visible():
        page.locator("#logout-button").click()
        expect(page.locator("#logout-button")).to_be_hidden()
    page.locator("#connection-owner").fill("sahildandia")
    page.locator("#connection-repo").fill("sahilportfolio")
    page.locator("#connection-branch").fill("master")
    page.locator("#github-token").fill(fixture.token)
    page.locator("#connect-button").click()


def verify_admin(browser, base, screenshots):
    fixture = MockGitHub()
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    context.route("https://api.github.com/**", fixture.handle)
    # Isolate the CMS/GitHub workflow from server authentication. Real login
    # and protected delivery are exercised separately in admin-auth.test.mjs
    # and admin-login-browser.py, without mocking their security checks.
    context.route("**/api/admin-auth", lambda route: route.fulfill(json={"configured": True, "authenticated": True}))
    def editor_fixture(route):
        name = urlsplit(route.request.url).path.removeprefix("/admin/") or "index.html"
        if name not in ("index.html", "admin.js", "admin.css", "access.js"):
            return route.continue_()
        content_type = "text/html" if name.endswith(".html") else "text/css" if name.endswith(".css") else "text/javascript"
        route.fulfill(body=(ROOT / "admin" / name).read_bytes(), content_type=content_type)
    context.route(re.compile(re.escape(urljoin(base, "admin/")) + r".*"), editor_fixture)
    page = context.new_page()
    runtime_errors = []
    console_errors = []

    def inspect_console(message):
        # Expected fixture API failures produce browser resource messages. All
        # application errors and every credential leak still fail the check.
        assert fixture.token not in message.text, "Credentials must never be logged"
        if message.type == "error" and not message.location.get("url", "").startswith("https://api.github.com/"):
            console_errors.append(message.text)

    page.on("pageerror", lambda error: runtime_errors.append(str(error)))
    page.on("console", inspect_console)
    page.on("dialog", lambda dialog: dialog.accept())
    page.goto(urljoin(base, "admin/"), wait_until="domcontentloaded")
    expect(page.locator("#profile-name")).to_have_value(fixture.content["profile"]["name"])
    expect(page.locator("#publish-button")).to_be_disabled()
    status = page.locator("#admin-status")
    edited_name = "Sahil Kumar – café 🚀"
    page.locator("#profile-name").fill(edited_name)
    page.locator("#save-draft").click()
    assert edited_name in page.evaluate("localStorage.getItem('sahil-portfolio-admin-draft')")
    page.locator("#profile-name").fill("Temporary unsaved edit")
    page.locator("#load-draft").click()
    expect(page.locator("#profile-name")).to_have_value(edited_name)

    # Add/delete a record through the same collection controls used by owners.
    before = page.locator('[data-record="skills"]').count()
    page.locator('[data-add="skills"]').click()
    expect(page.locator('[data-record="skills"]')).to_have_count(before + 1)
    page.locator(f'[name="skills.{before}.name"]').fill("Fixture tool")
    page.locator(f'[name="skills.{before}.category"]').fill("Tools")
    page.locator(f'[data-remove="skills"][data-index="{before}"]').click()
    expect(page.locator('[data-record="skills"]')).to_have_count(before)
    with page.expect_download() as export_info:
        page.locator("#export-button").click()
    exported = json.loads(Path(export_info.value.path()).read_text())
    assert exported["profile"]["name"] == edited_name
    assert len(exported["skills"]) == before

    imported = copy.deepcopy(exported)
    imported["projects"][0]["description"] = '<img src=x onerror="window.__portfolioInjected=true">'
    imported["profile"]["intro"] = "Unicode draft: café, हिन्दी, 🚀 & accessible interfaces."
    page.locator("#import-file").set_input_files({"name": "content.json", "mimeType": "application/json",
                                                 "buffer": json.dumps(imported, ensure_ascii=False).encode()})
    expect(page.locator("#profile-intro")).to_have_value(imported["profile"]["intro"])
    with page.expect_popup() as preview_info:
        page.locator("#preview-button").click()
    preview = preview_info.value
    preview.on("pageerror", lambda error: runtime_errors.append(str(error)))
    preview.on("console", inspect_console)
    wait_public_ready(preview)
    expect(preview.locator("#home")).to_contain_text(edited_name)
    expect(preview.locator("#home")).to_contain_text(imported["profile"]["intro"])
    assert preview.locator(".project-card").first.inner_text().find(imported["projects"][0]["description"]) >= 0
    assert not preview.evaluate("Boolean(window.__portfolioInjected)")
    assert preview.locator('img[src="x"]').count() == 0
    assert_no_token_persistence(preview, fixture.token)
    preview.close()
    assert not fixture.put_attempts
    invalid = copy.deepcopy(imported)
    invalid["projects"][0]["source"] = "javascript:alert(1)"
    page.locator("#import-file").set_input_files({"name": "invalid.json", "mimeType": "application/json",
                                                 "buffer": json.dumps(invalid).encode()})
    expect(status).to_contain_text(re.compile("invalid|HTTPS|validation|source", re.I))
    expect(page.locator("#profile-name")).to_have_value(edited_name)
    print("PASS admin editing, record controls, local drafts, import/export and escaped preview", flush=True)

    for denied_status, pattern in ((401, "401|credential|expired|token"), (403, "403|permission|access|token")):
        fixture.metadata_status = denied_status
        connect_admin(page, fixture)
        expect(status).to_contain_text(re.compile(pattern, re.I))
        expect(page.locator("#publish-button")).to_be_disabled()
        assert_no_token_persistence(page, fixture.token)
    fixture.metadata_status = 200
    fixture.push_permission = False
    connect_admin(page, fixture)
    expect(status).to_contain_text(re.compile("permission|write|push|access", re.I))
    expect(page.locator("#publish-button")).to_be_disabled()
    fixture.push_permission = True
    connect_admin(page, fixture)
    expect(page.locator("#publish-button")).to_be_enabled()
    expect(page.locator("#profile-name")).to_have_value(edited_name)
    assert_no_token_persistence(page, fixture.token)

    # An independent edit to GitHub must never be silently overwritten.
    fixture.sha = "b" * 40
    page.locator("#publish-button").click()
    expect(status).to_contain_text(re.compile("changed|conflict|reload|newer|409", re.I))
    assert not fixture.put_attempts
    expect(page.locator("#profile-name")).to_have_value(edited_name)
    for denied_status, pattern in ((409, "409|conflict|changed|SHA"), (403, "403|permission|access|token"), (401, "401|credential|expired|token")):
        fixture.put_status = denied_status
        connect_admin(page, fixture)
        expect(page.locator("#publish-button")).to_be_enabled()
        attempts = len(fixture.put_attempts)
        page.locator("#publish-button").click()
        expect(status).to_contain_text(re.compile(pattern, re.I))
        assert len(fixture.put_attempts) == attempts + 1
        assert not fixture.successes
        assert_no_token_persistence(page, fixture.token)
    print("PASS mocked GitHub authentication, permissions, stale SHA, 401, 403 and 409 handling", flush=True)

    fixture.put_status = 200
    connect_admin(page, fixture)
    expect(page.locator("#publish-button")).to_be_enabled()
    page.locator("#publish-button").click()
    expect(status).to_contain_text(re.compile("published|saved to GitHub|committed|success", re.I))
    assert len(fixture.successes) == 1
    assert fixture.successes[0]["profile"]["name"] == edited_name
    assert fixture.successes[0]["profile"]["intro"] == imported["profile"]["intro"]
    assert fixture.successes[0]["projects"][0]["description"] == imported["projects"][0]["description"]
    assert fixture.auth_ok, "GitHub requests must use the entered in-memory bearer token"
    assert_no_token_persistence(page, fixture.token)
    page.locator("#logout-button").click()
    expect(page.locator("#publish-button")).to_be_disabled()
    expect(page.locator("#github-token")).to_have_value("")
    expect(page.locator("#profile-name")).to_have_value(edited_name)
    assert_no_token_persistence(page, fixture.token)
    page.reload(wait_until="domcontentloaded")
    expect(page.locator("#publish-button")).to_be_disabled()
    expect(page.locator("#github-token")).to_have_value("")
    assert_no_token_persistence(page, fixture.token)
    for width in (320, 375, 768, 1440):
        page.set_viewport_size({"width": width, "height": 1000})
        assert_no_overflow(page, f"Admin width {width}")
    if screenshots:
        page.screenshot(path=str(screenshots / "admin.png"), scale="css", animations="disabled")
    assert not runtime_errors, runtime_errors
    assert not console_errors, console_errors
    print("PASS mocked UTF-8 GitHub publish, volatile credentials, logout/reload lock and admin responsive layout", flush=True)
    context.close()


def main():
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
        verify_public(browser, base, errors, screenshots)
        verify_mobile_and_motion(browser, base, errors, screenshots)
        verify_admin(browser, base, screenshots)
        errors.assert_clean()
        browser.close()
    print("PASS no public runtime/console/local-asset errors; all GitHub writes were mocked", flush=True)


if __name__ == "__main__":
    main()
