import React, { useRef, useState } from "react";
import { TextInput } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { MIN_PASSWORD_LENGTH } from "@/services/account";
import {
  AuthError,
  AuthField,
  AuthScreen,
  AuthSubmit,
  AuthSwitch,
  accountErrorMessage,
} from "@/components/AuthForm";

/**
 * Create an account: first name, last name, email, password — nothing else.
 * Email confirmation is off in this project's Supabase settings, so a
 * successful sign-up signs the user straight in.
 */
export default function RegisterScreen() {
  const { t } = useLocale();
  const { enabled, status, register } = useAuth();
  const router = useRouter();
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
      await register({ firstName, lastName, email, password });
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e) {
      setError(accountErrorMessage(t, e));
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={t("auth.registerTitle")}
      subtitle={enabled ? t("auth.registerSubtitle") : t("auth.notAvailable")}
    >
      <AuthField
        label={t("auth.firstName")}
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        textContentType="givenName"
        maxLength={50}
        returnKeyType="next"
        onSubmitEditing={() => lastNameRef.current?.focus()}
      />
      <AuthField
        ref={lastNameRef}
        label={t("auth.lastName")}
        value={lastName}
        onChangeText={setLastName}
        autoComplete="family-name"
        textContentType="familyName"
        maxLength={50}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <AuthField
        ref={emailRef}
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
        hint={t("auth.passwordHint").replace("{min}", String(MIN_PASSWORD_LENGTH))}
        value={password}
        onChangeText={setPassword}
        ltr
        password
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <AuthError message={error} />
      <AuthSubmit label={t("auth.submitRegister")} busy={busy} onPress={submit} />
      <AuthSwitch prompt={t("auth.haveAccount")} action={t("auth.toLogin")} onPress={() => router.replace("/login")} />
    </AuthScreen>
  );
}
