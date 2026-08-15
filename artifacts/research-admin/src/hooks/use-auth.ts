import { useEffect, useState } from "react";
import { authApi } from "@/lib/api";

type AuthState = "loading" | "authed" | "unauthenticated";

export function useAuth() {
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    authApi
      .me()
      .then(({ authed }) => setState(authed ? "authed" : "unauthenticated"))
      .catch(() => setState("unauthenticated"));
  }, []);

  const login = async (password: string) => {
    await authApi.login(password);
    setState("authed");
  };

  const logout = async () => {
    await authApi.logout();
    setState("unauthenticated");
  };

  return { state, login, logout };
}
