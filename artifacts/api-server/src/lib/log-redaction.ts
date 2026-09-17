/** Authentication material must not become readable application log data. */
export const logRedactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
  "accessCode",
  "access_code",
  "password",
  "passcode",
  "token",
  "secret",
  "*.accessCode",
  "*.access_code",
  "*.password",
  "*.passcode",
  "*.token",
  "*.secret",
  "req.body",
] as const;