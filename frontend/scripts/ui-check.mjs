// Headless UI check for CivicSense.
// Usage: node scripts/ui-check.mjs [baseUrl]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const results = [];

function check(ok, label, detail = "") {
  results.push({ ok, label, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${detail ? " - " + detail : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const context = page.context();
// Pretend the browser may share a position, and give it a known one.
await context.grantPermissions(["geolocation"], { origin: BASE });
await context.setGeolocation({ latitude: 19.0771, longitude: 72.8792 });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  check(await page.getByRole("heading", { name: "Report a civic issue" }).isVisible(), "submit page renders");

  await page.waitForSelector(".leaflet-container", { timeout: 15000 });
  check(true, "leaflet map container mounted");

  const tiles = await page.locator(".leaflet-tile-loaded").count();
  check(tiles > 0, "map tiles loaded", `${tiles} tiles`);

  const markers = await page.locator(".leaflet-interactive").count();
  check(markers > 0, "map pin rendered", `${markers} marker(s)`);

  // click the map to move the pin (element relative, so a scrolled page
  // cannot make the click land on something else)
  const submitMap = page.locator("form .leaflet-container").first();
  await submitMap.scrollIntoViewIfNeeded();
  await submitMap.click({ position: { x: 180, y: 90 } });
  await page.waitForTimeout(600);
  const coords = await page.locator("form .tabular-nums").first().textContent();
  check(
    /19\.\d{5}, 72\.\d{5}/.test(coords ?? ""),
    "clicking the map moves the pin",
    (coords ?? "").trim(),
  );

  // a place name can be searched instead of typing coordinates
  await page.getByPlaceholder(/search a place/i).fill("Library Crossing");
  await page.getByRole("button", { name: /find place/i }).click();
  await page.waitForTimeout(1500);
  const resolved = await page.locator("form").first().textContent();
  check(
    /library crossing/i.test(resolved ?? ""),
    "searching a place name sets the location",
  );
  const boxAfterSearch = await page.getByPlaceholder(/search a place/i).inputValue();
  check(
    /library crossing/i.test(boxAfterSearch),
    "the place name lands in the search box",
    boxAfterSearch,
  );
  const mapAfterSearch = await page
    .locator("form .leaflet-container")
    .first()
    .boundingBox();
  check(Boolean(mapAfterSearch), "the map is on screen after the search");

  // the map itself has to move to the place, not just the marker
  await page.waitForTimeout(1200);
  const markerBox = await page.locator(".leaflet-interactive").first().boundingBox();
  if (mapAfterSearch && markerBox) {
    const offsetX = Math.abs(
      markerBox.x + markerBox.width / 2 - (mapAfterSearch.x + mapAfterSearch.width / 2),
    );
    const offsetY = Math.abs(
      markerBox.y + markerBox.height / 2 - (mapAfterSearch.y + mapAfterSearch.height / 2),
    );
    check(
      offsetX < 40 && offsetY < 40,
      "the map shifts to the searched place",
      `pin ${Math.round(offsetX)}px / ${Math.round(offsetY)}px from the centre`,
    );
  } else {
    check(false, "the map shifts to the searched place", "no marker found");
  }

  // the browser can share the current position
  await page.getByRole("button", { name: /use my location/i }).click();
  await page.waitForTimeout(2000);
  const boxAfterGps = await page.getByPlaceholder(/search a place/i).inputValue();
  check(
    boxAfterGps.length > 0,
    "the detected location is written into the search box",
    boxAfterGps,
  );
  const located = await page.locator("form").first().textContent();
  check(
    /19\.077\d*, 72\.879\d*/.test(located ?? "") ||
      /taken from your device/i.test(located ?? ""),
    "use my location fills the position",
  );

  await page
    .getByPlaceholder("e.g. big pit on main road near gate 2, bikes skidding")
    .fill("big pit on main road near gate 2, bikes skidding");
  await page.getByRole("button", { name: /submit report/i }).click();
  // the first request after an API start loads the model, so allow for it
  await page.waitForSelector("text=Report submitted", { timeout: 120000 });
  const ticketText = await page.locator("code, .font-mono").first().textContent();
  const ticketId = (ticketText ?? "").trim();
  check(/^CS-/.test(ticketId), "submission returns a ticket id", ticketId);

  await page.screenshot({ path: "scripts/shot-submitted.png", fullPage: true });

  // photo upload exercises the CLIP branch of the classifier
  await page.getByRole("button", { name: /report another issue/i }).click();
  await page
    .getByPlaceholder("e.g. big pit on main road near gate 2, bikes skidding")
    .fill("garbage pile near the hostel gate");
  await page.setInputFiles('input[type="file"]', "scripts/shot-submitted.png");
  await page.getByRole("button", { name: /submit report/i }).click();
  await page.waitForSelector("text=Report submitted", { timeout: 120000 });
  const photoTicket = (
    (await page.locator("code, .font-mono").first().textContent()) ?? ""
  ).trim();
  check(/^CS-/.test(photoTicket), "photo submission returns a ticket id", photoTicket);

  // track the ticket
  await page.getByRole("link", { name: /track this ticket/i }).click();
  await page.waitForSelector("text=Track a ticket", { timeout: 15000 });
  await page.getByRole("button", { name: /^track$/i }).click();
  await page.waitForSelector("text=Ticket", { timeout: 15000 });
  const tracked = await page.locator(".font-mono.text-lg").first().textContent();
  check(
    (tracked ?? "").trim() === photoTicket,
    "ticket lookup shows the same ticket",
    tracked ?? "",
  );

  await page.screenshot({ path: "scripts/shot-ticket.png", fullPage: true });

  // operations dashboard is behind the admin login
  await page.getByRole("link", { name: /operations/i }).click();
  await page.waitForSelector("text=Admin sign in", { timeout: 20000 });
  check(true, "operations redirects to the login screen");

  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForSelector("text=Operations dashboard", { timeout: 30000 });
  check(true, "admin credentials open the dashboard");

  await page.waitForSelector("text=Priority queue", { timeout: 20000 });
  await page.waitForSelector("table tbody tr", { timeout: 20000 });

  const queueRows = await page.locator("table tbody tr").count();
  check(queueRows > 10, "priority queue lists complaints", `${queueRows} rows`);

  await page.waitForSelector("text=Duplicate candidates", { timeout: 20000 });
  const statCards = await page.locator("text=Duplicate candidates").count();
  check(statCards > 0, "summary cards rendered");

  await page.locator("table tbody tr").first().click();
  await page.waitForSelector("text=Why this category", { timeout: 15000 });
  check(true, "complaint detail panel opens");

  const alternatives = await page.locator("text=nearest prototype").count();
  check(alternatives > 0, "AI explanation shown in detail");

  await page.waitForSelector("text=Department load", { timeout: 15000 });
  check(true, "department workload rendered");

  await page.waitForSelector("text=Recurring hotspots", { timeout: 15000 });
  const hotspotTiles = await page.locator(".leaflet-tile-loaded").count();
  check(hotspotTiles > 0, "hotspot map tiles loaded", `${hotspotTiles} tiles`);

  // admin can add a location, by place name or by the current position
  const rowsBefore = await page.locator("table tbody tr").count();
  await page.getByRole("button", { name: /add location/i }).click();
  await page.waitForSelector("text=Add a location", { timeout: 15000 });

  await page.getByPlaceholder(/search a place/i).fill("Sports Complex");
  await page.getByRole("button", { name: /find place/i }).click();
  await page.waitForTimeout(1200);
  const coordText = await page.locator("form .tabular-nums").first().textContent();
  check(
    /19\.083\d*, 72\.879\d*/.test(coordText ?? ""),
    "the place name is resolved to a point",
    (coordText ?? "").trim(),
  );

  const map = page.locator("form .leaflet-container").first();
  await map.scrollIntoViewIfNeeded();
  await map.click({ position: { x: 120, y: 90 } });
  await page.waitForTimeout(600);
  const latAfter = await page.locator("form .tabular-nums").first().textContent();
  check(
    /19\.\d{5}, 72\.\d{5}/.test(latAfter ?? ""),
    "clicking the map moves the new pin",
    (latAfter ?? "").trim(),
  );

  await page
    .getByPlaceholder("e.g. water pipeline burst near the sports complex")
    .fill("water pipeline burst near the sports complex");
  await page.getByRole("button", { name: /save location/i }).click();
  await page.waitForSelector("text=Created CS-", { timeout: 60000 });
  check(true, "new location is saved from the dashboard");

  await page.waitForTimeout(800);
  const rowsAfter = await page.locator("table tbody tr").count();
  check(rowsAfter > rowsBefore, "queue shows the new report", `${rowsBefore} -> ${rowsAfter}`);

  await page.screenshot({ path: "scripts/shot-dashboard.png", fullPage: true });

  // a change made in the database has to show up after a refresh
  const target = await page
    .locator("table tbody tr")
    .filter({ hasText: "Submitted" })
    .first()
    .locator(".font-mono")
    .first()
    .textContent();
  const ticket = (target ?? "").trim();
  const changed = await page.evaluate(async (ticketId) => {
    const token = localStorage.getItem("civicsense.token");
    const rows = await fetch("/api/complaints?limit=200", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const row = rows.find((r) => r.ticket_id === ticketId);
    if (!row) return "not found";
    const response = await fetch(`/api/complaints/${row.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "triaged", reason: "ui check" }),
    });
    return response.ok ? "ok" : `http ${response.status}`;
  }, ticket);
  check(changed === "ok", "status changed through the API", changed);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 20000 });
  const rowText = await page
    .locator("table tbody tr")
    .filter({ hasText: ticket })
    .first()
    .textContent();
  check(
    /triaged/i.test(rowText ?? ""),
    "the change is visible after a refresh",
    ticket,
  );

  check(consoleErrors.length === 0, "no console errors", consoleErrors.slice(0, 2).join(" | "));
} catch (error) {
  check(false, "ui check crashed", String(error).slice(0, 300));
} finally {
  await browser.close();
}

const failures = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failures}/${results.length} UI checks passed`);
process.exit(failures ? 1 : 0);
