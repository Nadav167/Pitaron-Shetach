import React, { useRef, useState } from "react";
import { TextInput } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import {
  AuthError,
  AuthField,
  AuthScreen,
  AuthSubmit,
  AuthSwitch,
  accountErrorMessage,
} from "@/components/AuthForm";

/**
 * Log in with email + password. Reached from the header's "Log in" button;
 * on success it returns to wherever the user came from.
 */
export default function LoginScreen() {
  const { t } = useLocale();
  const { enabled, status, logIn } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "signedIn") return <Redirect href="/" />;

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await logIn(email, password);
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      setError(accountErrorMessage(t, e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen title={t("auth.loginTitle")} subtitle={enabled ? t("auth.loginSubtitle") : t("auth.notAvailable")}>
      <AuthField
        label={t("auth.email")}
        value={email}
        onChangeText={setEmail}
        ltr
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label={t("auth.password")}
        value={password}
        onChangeText={setPassword}
        ltr
        password
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <AuthError message={error} />
      <AuthSubmit label={t("auth.submitLogin")} busy={busy} onPress={submit} />
      <AuthSwitch prompt={t("auth.noAccount")} action={t("auth.toRegister")} onPress={() => router.replace("/register")} />
    </AuthScreen>
  );
}
