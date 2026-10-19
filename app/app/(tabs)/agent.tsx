import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from "react-native";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { useThemeColors } from "@/context/ThemeContext";
import { useResponsive } from "@/hooks/useResponsive";
import EmptyState from "@/components/EmptyState";
import { AgentError, sendAgentMessage } from "@/services/agent";
import { loadJSON, saveJSON } from "@/lib/storage";
import { stripMarkdown, textDirection } from "@/lib/text";
import { fonts, radius, spacing, type ColorTokens } from "@/constants/theme";
import type { AgentChatMessage } from "@/types/itinerary";

/**
 * The travel agent's chat. Signed-in users only (each message costs the site
 * owner an API call, and itineraries are saved to the account); everyone
 * else gets a prompt to log in.
 *
 * The conversation lives here, in the app: it is sent whole with each new
 * message (the agent itself is stateless) and kept on the device per user,
 * so it survives a reload. Saved itineraries are the durable part; they are
 * in the database and on the Itineraries tab.
 */

const MAX_KEPT_MESSAGES = 40;
/** After this long, "Thinking..." becomes "Planning your trip... up to a minute". */
const LONG_WAIT_MS = 6000;
/** Clearance for the floating tab bar on phone widths (see (tabs)/_layout). */
const TAB_BAR_CLEARANCE = 64 + 18 + spacing.sm;

export default function AgentScreen() {
  const { enabled, status, userId } = useAuth();
  const { t } = useLocale();
  const colors = useThemeColors();

  if (!enabled) return <EmptyState message={t("agent.notAvailable")} />;
  if (status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (status !== "signedIn" || !userId) return <LoginPrompt />;
  // Keyed by user, so logging in as someone else starts from their own chat.
  return <AgentChat key={userId} userId={userId} />;
}

function LoginPrompt() {
  const { t, writingDirection } = useLocale();
  const colors = useThemeColors();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.promptContent}>
      <View style={styles.promptCard}>
        <View style={styles.promptIcon}>
          <MaterialCommunityIcons name="compass-outline" size={30} color={colors.onPrimary} />
        </View>
        <Text style={styles.promptTitle}>{t("agent.loginTitle")}</Text>
        <Text style={styles.promptBody}>{t("agent.loginBody")}</Text>
        <View style={styles.promptButtons}>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/login")} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>{t("agent.login")}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/register")} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>{t("agent.register")}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function AgentChat({ userId }: { userId: string }) {
  const { t, locale, writingDirection } = useLocale();
  const colors = useThemeColors();
  const { isDesktop } = useResponsive();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors, writingDirection), [colors, writingDirection]);

  const storageKey = `agentChat:${userId}`;
  const [messages, setMessages] = useState<AgentChatMessage[]>(() => loadJSON<AgentChatMessage[]>(storageKey) ?? []);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const [errorCode, setErrorCode] = useState<AgentError["code"] | null>(null);
  const [messagesLeft, setMessagesLeft] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    saveJSON(storageKey, messages.slice(-MAX_KEPT_MESSAGES));
  }, [storageKey, messages]);

  useEffect(() => {
    if (!pending) {
      setLongWait(false);
      return;
    }
    const timer = setTimeout(() => setLongWait(true), LONG_WAIT_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  /** Sends the conversation (ending with the user's message) and appends the reply. */
  const ask = useCallback(
    async (conversation: AgentChatMessage[]) => {
      setPending(true);
      setErrorCode(null);
      try {
        const response = await sendAgentMessage(conversation, locale);
        setMessages([
          ...conversation,
          { role: "assistant", content: response.reply, ...(response.itinerary ? { itinerary: response.itinerary } : {}) },
        ]);
        setMessagesLeft(response.messagesLeft);
      } catch (error) {
        setErrorCode(error instanceof AgentError ? error.code : "agentFailed");
      } finally {
        setPending(false);
      }
    },
    [locale]
  );

  const send = (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    const conversation: AgentChatMessage[] = [...messages, { role: "user", content }];
    setMessages(conversation);
    setDraft("");
    void ask(conversation);
  };

  const newChat = () => {
    if (pending) return;
    setMessages([]);
    setErrorCode(null);
  };

  // Web: Enter sends, Shift+Enter adds a line.
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (Platform.OS !== "web") return;
    const native = event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (native.key === "Enter" && !native.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };

  // A failed request can be re-sent unchanged; limits and config errors can't.
  const canRetry = errorCode === "agentFailed" || errorCode === "network";
  const suggestions = ["agent.suggestion1", "agent.suggestion2", "agent.suggestion3", "agent.suggestion4"];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.column, isDesktop && styles.columnDesktop]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{t("agent.title")}</Text>
            <Text style={styles.subtitle}>{t("agent.subtitle")}</Text>
          </View>
          {messages.length > 0 && (
            <Pressable
              onPress={newChat}
              disabled={pending}
              style={({ pressed }) => [styles.newChat, (pressed || pending) && styles.pressed]}
              accessibilityRole="button"
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
              <Text style={styles.newChatText}>{t("agent.newChat")}</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        >
          <Bubble role="assistant" text={t("agent.welcome")} styles={styles} />

          {messages.length === 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => send(t(key))}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.suggestionText}>{t(key)}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {messages.map((message, index) => (
            <Bubble key={index} role={message.role} text={message.content} styles={styles}>
              {message.itinerary && (
                <Pressable
                  onPress={() => router.push(`/itinerary/${message.itinerary!.id}`)}
                  style={({ pressed }) => [styles.itineraryCard, pressed && styles.pressed]}
                  accessibilityRole="link"
                >
                  <MaterialCommunityIcons name="map-check-outline" size={22} color={colors.accentDeep} />
                  <View style={styles.itineraryCardText}>
                    <Text style={styles.itineraryCardLabel}>{t("agent.itinerarySaved")}</Text>
                    <Text style={styles.itineraryCardTitle} numberOfLines={2}>
                      {message.itinerary.title}
                    </Text>
                  </View>
                  <Text style={styles.itineraryCardAction}>{t("agent.openItinerary")}</Text>
                </Pressable>
              )}
            </Bubble>
          ))}

          {pending && (
            <View style={[styles.bubble, styles.assistantBubble, styles.pendingBubble]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.pendingText}>{t(longWait ? "agent.thinkingLong" : "agent.thinking")}</Text>
            </View>
          )}

          {errorCode && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{t(`agent.error.${errorCode}`)}</Text>
              {canRetry && (
                <Pressable onPress={() => void ask(messages)} style={styles.retry} accessibilityRole="button">
                  <Text style={styles.retryText}>{t("agent.retry")}</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        <View style={[styles.composerArea, !isDesktop && { paddingBottom: TAB_BAR_CLEARANCE }]}>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onKeyPress={onKeyPress}
              placeholder={t("agent.placeholder")}
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={2000}
              style={[styles.input, { writingDirection: draft ? textDirection(draft) : writingDirection }]}
              accessibilityLabel={t("agent.placeholder")}
            />
            <Pressable
              onPress={() => send(draft)}
              disabled={pending || !draft.trim()}
              style={({ pressed }) => [styles.sendButton, (pressed || pending || !draft.trim()) && styles.sendDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t("agent.send")}
            >
              {/* Points left: in a right-to-left layout, "forward" is leftward. */}
              <MaterialCommunityIcons name="send" size={20} color={colors.onAccent} style={styles.sendIcon} />
            </Pressable>
          </View>
          <Text style={styles.footnote}>
            {messagesLeft != null ? `${t("agent.messagesLeft").replace("{n}", String(messagesLeft))} · ` : ""}
            {t("agent.disclaimer")}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function Bubble({
  role,
  text,
  styles,
  children,
}: {
  role: "user" | "assistant";
  text: string;
  styles: Styles;
  children?: React.ReactNode;
}) {
  const shown = role === "assistant" ? stripMarkdown(text) : text;
  // Each bubble reads in its own language's direction (a Hebrew question in
  // the English UI still reads right-to-left).
  const direction = textDirection(shown);
  return (
    <View style={[styles.bubble, role === "user" ? styles.userBubble : styles.assistantBubble]}>
      <Text
        selectable
        style={[
          role === "user" ? styles.userText : styles.assistantText,
          { writingDirection: direction, textAlign: direction === "rtl" ? "right" : "left" },
        ]}
      >
        {shown}
      </Text>
      {children}
    </View>
  );
}

function makeStyles(colors: ColorTokens, writingDirection: "rtl" | "ltr") {
  const textAlign = "right" as const;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    column: { flex: 1, width: "100%" },
    columnDesktop: { maxWidth: 820, alignSelf: "center", paddingTop: spacing.md },
    pressed: { opacity: 0.7 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerText: { flex: 1 },
    title: { fontFamily: fonts.display, fontSize: 22, color: colors.text, textAlign, writingDirection },
    subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, textAlign, writingDirection },
    newChat: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: spacing.sm + 4,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryTint,
    },
    newChatText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.primary },

    messages: { flex: 1 },
    messagesContent: { padding: spacing.md, gap: spacing.sm + 2 },
    bubble: { maxWidth: "88%", borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 },
    // The layout is right-to-left: flex-start is the right edge.
    assistantBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderTopRightRadius: 4,
    },
    userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary, borderTopLeftRadius: 4 },
    assistantText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.text },
    userText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.onPrimary },
    pendingBubble: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    pendingText: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, writingDirection },

    suggestions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingVertical: spacing.xs },
    suggestion: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundElevated,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    suggestionText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text, writingDirection },

    itineraryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.sm,
      padding: spacing.sm + 2,
      borderRadius: radius.sm,
      backgroundColor: colors.accentTint,
    },
    itineraryCardText: { flex: 1 },
    itineraryCardLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accentDeep, textAlign, writingDirection },
    itineraryCardTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text, textAlign, writingDirection },
    itineraryCardAction: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },

    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
      padding: spacing.sm + 2,
      borderRadius: radius.sm,
      backgroundColor: colors.dangerTint,
    },
    errorText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.danger, textAlign, writingDirection },
    retry: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
    retryText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.primary },

    composerArea: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md },
    composer: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: spacing.sm,
      padding: 6,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      minHeight: 40,
      maxHeight: 120,
      paddingHorizontal: 10,
      paddingVertical: 9,
      fontFamily: fonts.body,
      fontSize: 15,
      color: colors.text,
      textAlign,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    sendDisabled: { opacity: 0.45 },
    sendIcon: { transform: [{ scaleX: -1 }] },
    footnote: {
      marginTop: 6,
      fontFamily: fonts.body,
      fontSize: 11,
      color: colors.textFaint,
      textAlign: "center",
      writingDirection,
    },

    promptContent: { flexGrow: 1, justifyContent: "center", padding: spacing.lg, paddingBottom: TAB_BAR_CLEARANCE },
    promptCard: {
      alignSelf: "center",
      width: "100%",
      maxWidth: 440,
      alignItems: "center",
      gap: spacing.sm + 4,
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    promptIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    promptTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.text, textAlign: "center", writingDirection },
    promptBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: "center", writingDirection },
    promptButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    primaryButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 10 },
    primaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.onPrimary },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 22,
      paddingVertical: 10,
    },
    secondaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.primary },
  });
}
