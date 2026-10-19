#!/usr/bin/env python3
"""Exercise real HTTP login/session protection using temporary test credentials.
No Vercel credentials or GitHub token are needed, printed, or persisted.
"""
import os
import re
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
TEST_ID = "fixture-owner"
TEST_PASSWORD = "fixture-only-passphrase-42!"

def start_server(configured=True):
    variables = dict(os.environ)
    variables.update(PORT="0", VERCEL="0", ADMIN_ID=TEST_ID if configured else "",
                     ADMIN_PASSWORD=TEST_PASSWORD if configured else "",
                     ADMIN_SESSION_SECRET="fixture-only-signing-key-" * 3 if configured else "invalid-test-override")
    process = subprocess.Popen(["node", "scripts/dev-server.mjs"], cwd=ROOT,
                               env=variables, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    line = process.stdout.readline()
    match = re.search(r"port (\d+)", line)
    if not match:
        process.terminate()
        raise AssertionError("The development server did not start")
    return process, "http://127.0.0.1:" + match.group(1)

def main():
    process, base = start_server()
    missing = None
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base + "/admin/", wait_until="networkidle")
            expect(page.locator("#admin-login")).to_be_visible()
            expect(page.locator("#login-button")).to_be_enabled()
            assert page.locator("#content-form").count() == 0
            page.evaluate("localStorage.setItem('admin-authenticated', 'true')")
            page.reload(wait_until="networkidle")
            expect(page.locator("#admin-login")).to_be_visible()
            for path in ("/admin/admin.js", "/admin/admin.css", "/admin/access.js", "/api/admin-page?file=admin.js"):
                assert context.request.get(base + path).status == 401
            page.locator("#admin-id").fill(TEST_ID)
            page.locator("#admin-password").fill("incorrect-password")
            page.locator("#login-button").click()
            expect(page.locator("#login-status")).to_contain_text("incorrect")
            assert page.locator("#admin-password").input_value() == ""
            page.locator("#admin-password").fill(TEST_PASSWORD)
            page.locator("#login-button").click()
            expect(page.locator("#profile-name")).to_be_visible()
            assert context.request.get(base + "/admin/admin.js").status == 200
            cookies = context.cookies()
            session = next(c for c in cookies if c["name"] == "portfolio_admin")
            assert session["httpOnly"] and session["sameSite"] == "Strict"
            assert "portfolio_admin" not in page.evaluate("document.cookie")
            for width in (320,375,768,1440):
                page.set_viewport_size({"width":width,"height":1000})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.locator("#profile-name").fill("Saved before locking")
            page.locator("#lock-admin").click()
            expect(page.locator("#admin-login")).to_be_visible()
            assert context.request.get(base + "/admin/admin.js").status == 401
            assert "Saved before locking" in page.evaluate("localStorage.getItem('sahil-portfolio-admin-draft')")
            stored = page.evaluate("JSON.stringify({local:{...localStorage},session:{...sessionStorage}})")
            assert TEST_PASSWORD not in stored
            assert TEST_PASSWORD not in page.url
            assert not any(c["name"] == "portfolio_admin" and c["value"] for c in context.cookies())
            for width in (320,375,768,1440):
                page.set_viewport_size({"width":width,"height":1000})
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            assert not errors, errors
            print("PASS real login, protected files, HttpOnly session, lock, draft preservation, and responsive layout")
            missing, missing_base = start_server(False)
            page.goto(missing_base + "/admin/", wait_until="networkidle")
            expect(page.locator("#login-status")).to_contain_text("not configured correctly")
            expect(page.locator("#login-button")).to_be_disabled()
            assert page.locator("#content-form").count() == 0
            assert context.request.get(missing_base + "/admin/admin.js").status == 401
            print("PASS invalid credential overrides fail closed")
            browser.close()
    finally:
        for child in (process,missing):
            if child:
                child.terminate()
                child.wait(timeout=10)

if __name__ == "__main__":
    main()
