import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSheet } from "./parse";

const header = "名称,地点,开展日期,申请日期,申请结果,状态,预计总人流,官方网页,其他连接,注释";

function csv(rows: string[]): string {
  return [header, ...rows].join("\n");
}

describe("sheet date heuristic and status map", () => {
  it("reads FanimeCon 27 as an unconfirmed application window", () => {
    const [row] = parseSheet(
      csv(['FanimeCon 27,San Jose,5/22/2027,11/08/2026,,留意中,"27,500",fanime.com,,限时申请']),
      "2026-11-04",
    );
    assert.equal(row.identityKey, "fanimecon");
    assert.equal(row.displayName, "FanimeCon");
    assert.equal(row.cycleLabel, "2027");
    assert.equal(row.status, "waiting_to_apply");
    assert.deepEqual(row.dates, {
      kind: "application_window",
      applicationStartDate: "2026-11-08",
      applicationEndDate: null,
    });
    assert.equal(row.reviewReason, null);
    assert.equal(row.attendance, 27500);
    assert.equal(row.notes, "限时申请");
  });

  it("reads SacAnime Summer 26 result dates as submitted and rejected", () => {
    const [row] = parseSheet(
      csv(["SacAnime Summer 26,,9/4/2026,6/5/2026,6/17/2026,已拒绝,\"21,000\",https://sacanime.com/,,"]),
      "2026-11-04",
    );
    assert.equal(row.identityKey, "sacanime");
    assert.equal(row.cycleLabel, "2026-summer");
    assert.equal(row.status, "rejected");
    assert.deepEqual(row.dates, {
      kind: "submitted",
      submittedAt: "2026-06-05",
      resultDate: "2026-06-17",
    });
    assert.equal(row.reviewReason, null);
  });

  it("keeps Zenkaikon ended windows in review with dates from the note", () => {
    const [row] = parseSheet(
      csv(['Zenkaikon,"Lancaster, PA",3/18/2027,2026-09-12,,申请已结束,"9,000+",https://zenkaikon.com/,,AA申请 9/12 - 9/20']),
      "2026-11-04",
    );
    assert.equal(row.reviewReason, "ended_window");
    assert.equal(row.status, "unknown");
    assert.deepEqual(row.dates, {
      kind: "ended_window",
      applicationStartDate: "2026-09-12",
      applicationEndDate: "2026-09-20",
    });
  });

  it("leaves a dated accepted row unresolved and keeps SJ Made events as their own series", () => {
    const rows = parseSheet(
      csv([
        "SJ Made Winter Wonder Market,San Jose,12/12/2026,7/20/2026,,已通过,Unknown,,,",
        'Magwest,SAN JOSE,8/12/2026,,,Pass,"1,000+",https://magwest.org/,,',
      ]),
      "2026-11-04",
    );
    assert.equal(rows[0].identityKey, "sjmadewinterwondermarket");
    assert.equal(rows[0].displayName, "SJ Made Winter Wonder Market");
    assert.equal(rows[0].status, "approved");
    assert.equal(rows[0].reviewReason, "unresolved_date");
    assert.equal(rows[1].status, "skipped");
    assert.equal(rows[1].reviewReason, null);
    assert.equal(rows[1].attendance, 1000);
  });

  it("extracts a parenthetical alias and classifies form and discord links", () => {
    const [row] = parseSheet(
      csv([
        'castlepoint (cpac),"Secaucus, NJ",4/24/2027,,12/11/2026,已申请,5000,https://www.castlepointanime.com/,"https://forms.gle/x\nhttps://discord.com/channels/1/2/3",',
      ]),
      "2026-11-04",
    );
    assert.equal(row.identityKey, "castlepoint");
    assert.deepEqual(row.aliasCandidates, ["cpac"]);
    assert.equal(row.status, "submitted");
    assert.deepEqual(row.dates, { kind: "submitted", submittedAt: null, resultDate: "2026-12-11" });
    assert.equal(row.links.some((link) => link.kind === "google_form"), true);
    assert.equal(row.links.some((link) => link.kind === "discord"), true);
  });
});
