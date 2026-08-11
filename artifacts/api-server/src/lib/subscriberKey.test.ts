/**
 * Unit test: subscriberKey returns a distinct portal-prefixed key for each
 * portal's auth convention, and only falls back to "__noauth__" when ALL
 * portal fields are absent.
 *
 * We call subscriberKey directly with hand-built req/res stand-ins rather than
 * routing through Express, so each portal's res.locals / req.session shape can
 * be parametrised precisely.
 */

import { describe, it, expect } from "vitest";
import type { Request, Response } from "express";
import { subscriberKey } from "./aiRateLimit";
import { deviceSeatKey } from "./seatLimits";

interface Shape {
  locals?: Record<string, unknown>;
  session?: Record<string, unknown>;
  sessionID?: string;
  userId?: number;
}

const IP = "203.0.113.9";
const UA = "vitest-agent/1.0";

function makeReqRes(shape: Shape): { req: Request; res: Response } {
  const req = {
    ip: IP,
    headers: { "user-agent": UA },
    session: shape.session,
    sessionID: shape.sessionID,
    ...(shape.userId !== undefined ? { userId: shape.userId } : {}),
  } as unknown as Request;
  const res = { locals: shape.locals ?? {} } as unknown as Response;
  return { req, res };
}

// Expected device fingerprint for the fixed IP/UA above.
const device = deviceSeatKey(makeReqRes({}).req);

describe("subscriberKey per-portal buckets", () => {
  const cases: Array<{
    portal: string;
    shape: Shape;
    expected: string;
  }> = [
    {
      portal: "CCB (res.locals.ccbAccessCodeId)",
      shape: { locals: { ccbAccessCodeId: 11 } },
      expected: `ccb:11:${device}`,
    },
    {
      portal: "Accident (res.locals.accidentAccessCodeId)",
      shape: { locals: { accidentAccessCodeId: 22 } },
      expected: `accident:22:${device}`,
    },
    {
      portal: "Corp (res.locals.accessCodeId)",
      shape: { locals: { accessCodeId: 33 } },
      expected: `corp:33:${device}`,
    },
    {
      portal: "Crim (res.locals.accessCode.id + session ID)",
      shape: { locals: { accessCode: { id: 44, tier: "full" } }, sessionID: "sess-crim" },
      expected: "crim:44:sess-crim",
    },
    {
      portal: "Crim without session ID falls back to device fingerprint",
      shape: { locals: { accessCode: { id: 44, tier: "full" } } },
      expected: `crim:44:${device}`,
    },
    {
      portal: "Acad (res.locals.user.id, string uuid)",
      shape: { locals: { user: { id: "a1b2c3-uuid" } } },
      expected: "acad:a1b2c3-uuid",
    },
    {
      portal: "Sya (req.session.userId + session ID)",
      shape: { session: { userId: 7 }, sessionID: "sess-sya" },
      expected: "sya:7:sess-sya",
    },
    {
      portal: "Lit (req.session.accessCodeId + session ID)",
      shape: { session: { accessCodeId: 42 }, sessionID: "sess-lit" },
      expected: "lit:42:sess-lit",
    },
    {
      portal: "Convey (req.userId)",
      shape: { userId: 55 },
      expected: "convey:55",
    },
  ];

  it.each(cases)("$portal → $expected", ({ shape, expected }) => {
    const { req, res } = makeReqRes(shape);
    expect(subscriberKey(req, res)).toBe(expected);
  });

  it("two subscribers on the same portal get different buckets", () => {
    for (const [a, b] of [
      [{ locals: { ccbAccessCodeId: 1 } }, { locals: { ccbAccessCodeId: 2 } }],
      [{ locals: { accessCodeId: 1 } }, { locals: { accessCodeId: 2 } }],
      [
        { session: { accessCodeId: 1 }, sessionID: "s1" },
        { session: { accessCodeId: 2 }, sessionID: "s2" },
      ],
      [{ userId: 1 }, { userId: 2 }],
    ] as Shape[][]) {
      const ka = subscriberKey(makeReqRes(a).req, makeReqRes(a).res);
      const kb = subscriberKey(makeReqRes(b).req, makeReqRes(b).res);
      expect(ka).not.toBe(kb);
      expect(ka).not.toBe("__noauth__");
      expect(kb).not.toBe("__noauth__");
    }
  });

  describe("__noauth__ fallback", () => {
    it("is returned only when ALL portal fields are absent", () => {
      const { req, res } = makeReqRes({});
      expect(subscriberKey(req, res)).toBe("__noauth__");
    });

    it("is returned when portal fields are present but of the wrong type", () => {
      // Values that must NOT match any branch (e.g. string where number is
      // required, master session accessCode with null id, null user).
      const { req, res } = makeReqRes({
        locals: {
          ccbAccessCodeId: null,
          accidentAccessCodeId: "not-a-number",
          accessCodeId: undefined,
          accessCode: { tier: "full", createdAt: null }, // crim master session — no id
          user: null,
        },
        session: { userId: null, accessCodeId: undefined },
        sessionID: "sess-x",
      });
      expect(subscriberKey(req, res)).toBe("__noauth__");
    });

    it("is NOT returned when any single portal field is present", () => {
      for (const shape of [
        { locals: { ccbAccessCodeId: 1 } },
        { locals: { accidentAccessCodeId: 1 } },
        { locals: { accessCodeId: 1 } },
        { locals: { accessCode: { id: 1 } } },
        { locals: { user: { id: "u" } } },
        { session: { userId: 1 } },
        { session: { accessCodeId: 1 } },
        { userId: 1 },
      ] as Shape[]) {
        const { req, res } = makeReqRes(shape);
        expect(subscriberKey(req, res)).not.toBe("__noauth__");
      }
    });
  });
});
