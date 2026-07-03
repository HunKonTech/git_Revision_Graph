package com.hunkontech.revgraph.util;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A tiny, dependency-free JSON serializer + parser.
 *
 * <p>The other JVM host (JetBrains) leans on Gson, but adding Gson to an OSGi
 * bundle means dragging in an extra required bundle and pinning it in the
 * target platform. To keep this Eclipse plugin fully self-contained — needing
 * nothing beyond the core Eclipse Platform (SWT + UI + resources) — we do our
 * own JSON here instead. It mirrors Gson's defaults closely enough for the
 * shared web renderer: field names stay camelCase (matching the {@code Dtos}
 * field names), and {@code null} fields are omitted.
 *
 * <p>Serialization ({@link #stringify}) handles the exact value shapes the host
 * produces: {@link Map} (host-&gt;webview event envelopes), {@link Iterable}
 * (lists of DTOs), primitives/strings, and arbitrary objects via reflection
 * over their public fields (the {@code Dtos} classes). Parsing ({@link #parse})
 * is a small recursive-descent reader used only for the flat inbound
 * {@code WebviewMessage} payloads.
 */
public final class Json {

    private Json() {
    }

    // ------------------------------------------------------------------
    // Serialize
    // ------------------------------------------------------------------

    public static String stringify(Object value) {
        StringBuilder sb = new StringBuilder();
        write(sb, value);
        return sb.toString();
    }

    private static void write(StringBuilder sb, Object v) {
        if (v == null) {
            sb.append("null");
        } else if (v instanceof String) {
            writeString(sb, (String) v);
        } else if (v instanceof Boolean || v instanceof Integer || v instanceof Long
                || v instanceof Short || v instanceof Byte) {
            sb.append(v.toString());
        } else if (v instanceof Double || v instanceof Float) {
            double d = ((Number) v).doubleValue();
            if (!Double.isInfinite(d) && !Double.isNaN(d) && d == Math.rint(d)) {
                sb.append(Long.toString((long) d));
            } else {
                sb.append(v.toString());
            }
        } else if (v instanceof Number) {
            sb.append(v.toString());
        } else if (v instanceof Map<?, ?>) {
            writeMap(sb, (Map<?, ?>) v);
        } else if (v instanceof Iterable<?>) {
            writeArray(sb, (Iterable<?>) v);
        } else if (v instanceof Enum<?>) {
            writeString(sb, ((Enum<?>) v).name());
        } else {
            writeObject(sb, v);
        }
    }

    private static void writeMap(StringBuilder sb, Map<?, ?> map) {
        sb.append('{');
        boolean first = true;
        for (Map.Entry<?, ?> e : map.entrySet()) {
            Object val = e.getValue();
            if (val == null) {
                continue; // omit nulls, matching Gson's default
            }
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, String.valueOf(e.getKey()));
            sb.append(':');
            write(sb, val);
        }
        sb.append('}');
    }

    private static void writeArray(StringBuilder sb, Iterable<?> it) {
        sb.append('[');
        boolean first = true;
        for (Object e : it) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            write(sb, e);
        }
        sb.append(']');
    }

    /** Serialize an arbitrary object by reflecting over its public non-static fields. */
    private static void writeObject(StringBuilder sb, Object obj) {
        sb.append('{');
        boolean first = true;
        for (Field f : obj.getClass().getFields()) {
            if (Modifier.isStatic(f.getModifiers())) {
                continue;
            }
            Object val;
            try {
                val = f.get(obj);
            } catch (IllegalAccessException ex) {
                continue;
            }
            if (val == null) {
                continue; // omit nulls, matching Gson's default
            }
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, f.getName());
            sb.append(':');
            write(sb, val);
        }
        sb.append('}');
    }

    private static void writeString(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }

    // ------------------------------------------------------------------
    // Parse (recursive descent; enough for the flat inbound messages)
    // ------------------------------------------------------------------

    /**
     * Parse a JSON document into a graph of {@link Map}&lt;String,Object&gt;,
     * {@link List}&lt;Object&gt;, {@link String}, {@link Double},
     * {@link Boolean}, or {@code null}. Throws {@link IllegalArgumentException}
     * on malformed input.
     */
    public static Object parse(String text) {
        Parser p = new Parser(text);
        p.skipWhitespace();
        Object value = p.parseValue();
        p.skipWhitespace();
        if (!p.atEnd()) {
            throw new IllegalArgumentException("Trailing content after JSON value");
        }
        return value;
    }

    private static final class Parser {
        private final String s;
        private int i;

        Parser(String s) {
            this.s = s;
        }

        boolean atEnd() {
            return i >= s.length();
        }

        void skipWhitespace() {
            while (i < s.length()) {
                char c = s.charAt(i);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                    i++;
                } else {
                    break;
                }
            }
        }

        Object parseValue() {
            skipWhitespace();
            if (atEnd()) {
                throw new IllegalArgumentException("Unexpected end of JSON");
            }
            char c = s.charAt(i);
            switch (c) {
                case '{':
                    return parseObject();
                case '[':
                    return parseArray();
                case '"':
                    return parseString();
                case 't':
                case 'f':
                    return parseBoolean();
                case 'n':
                    return parseNull();
                default:
                    return parseNumber();
            }
        }

        Map<String, Object> parseObject() {
            Map<String, Object> map = new LinkedHashMap<>();
            expect('{');
            skipWhitespace();
            if (peek() == '}') {
                i++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                char c = next();
                if (c == '}') {
                    break;
                }
                if (c != ',') {
                    throw new IllegalArgumentException("Expected ',' or '}' in object");
                }
            }
            return map;
        }

        List<Object> parseArray() {
            List<Object> list = new ArrayList<>();
            expect('[');
            skipWhitespace();
            if (peek() == ']') {
                i++;
                return list;
            }
            while (true) {
                list.add(parseValue());
                skipWhitespace();
                char c = next();
                if (c == ']') {
                    break;
                }
                if (c != ',') {
                    throw new IllegalArgumentException("Expected ',' or ']' in array");
                }
            }
            return list;
        }

        String parseString() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                if (atEnd()) {
                    throw new IllegalArgumentException("Unterminated string");
                }
                char c = s.charAt(i++);
                if (c == '"') {
                    break;
                }
                if (c == '\\') {
                    char e = s.charAt(i++);
                    switch (e) {
                        case '"':
                            sb.append('"');
                            break;
                        case '\\':
                            sb.append('\\');
                            break;
                        case '/':
                            sb.append('/');
                            break;
                        case 'n':
                            sb.append('\n');
                            break;
                        case 'r':
                            sb.append('\r');
                            break;
                        case 't':
                            sb.append('\t');
                            break;
                        case 'b':
                            sb.append('\b');
                            break;
                        case 'f':
                            sb.append('\f');
                            break;
                        case 'u':
                            String hex = s.substring(i, i + 4);
                            sb.append((char) Integer.parseInt(hex, 16));
                            i += 4;
                            break;
                        default:
                            throw new IllegalArgumentException("Bad escape: \\" + e);
                    }
                } else {
                    sb.append(c);
                }
            }
            return sb.toString();
        }

        Boolean parseBoolean() {
            if (s.startsWith("true", i)) {
                i += 4;
                return Boolean.TRUE;
            }
            if (s.startsWith("false", i)) {
                i += 5;
                return Boolean.FALSE;
            }
            throw new IllegalArgumentException("Invalid literal at " + i);
        }

        Object parseNull() {
            if (s.startsWith("null", i)) {
                i += 4;
                return null;
            }
            throw new IllegalArgumentException("Invalid literal at " + i);
        }

        Double parseNumber() {
            int start = i;
            while (i < s.length()) {
                char c = s.charAt(i);
                if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.' || c == 'e' || c == 'E') {
                    i++;
                } else {
                    break;
                }
            }
            if (i == start) {
                throw new IllegalArgumentException("Invalid JSON at " + i);
            }
            return Double.parseDouble(s.substring(start, i));
        }

        private char peek() {
            return atEnd() ? '\0' : s.charAt(i);
        }

        private char next() {
            if (atEnd()) {
                throw new IllegalArgumentException("Unexpected end of JSON");
            }
            return s.charAt(i++);
        }

        private void expect(char c) {
            char got = next();
            if (got != c) {
                throw new IllegalArgumentException("Expected '" + c + "' but got '" + got + "'");
            }
        }
    }
}
