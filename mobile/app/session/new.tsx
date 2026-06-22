import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createSession } from '../../lib/api';
import { useClub } from '../../lib/club';
import { Button, Card, Label } from '../../lib/ui';
import { colors, radius, space } from '../../lib/theme';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewSessionScreen() {
  const router = useRouter();
  const { activeClubId } = useClub();
  const [name, setName] = useState('');
  const [balls, setBalls] = useState('24');
  const [penalty, setPenalty] = useState('5');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!activeClubId) {
      setError('No active club selected.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const s = await createSession({
        club_id: activeClubId,
        name: name.trim() || null,
        session_date: todayISO(),
        balls_per_batsman: Math.max(1, parseInt(balls, 10) || 24),
        out_penalty: Math.max(0, parseInt(penalty, 10) || 0),
      });
      router.replace(`/session/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: space.lg, gap: space.md }}>
      <Card>
        <Label>Session name (optional)</Label>
        <TextInput
          placeholder="e.g. Sunday Nets"
          placeholderTextColor={colors.textFaint}
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Label>Balls per batsman</Label>
            <TextInput
              value={balls}
              onChangeText={setBalls}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Out penalty (runs)</Label>
            <TextInput
              value={penalty}
              onChangeText={setPenalty}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
        </View>

        <Text style={styles.note}>
          Each batter faces {balls || '24'} balls. Getting out subtracts {penalty || '0'} runs from their net
          score — so a careful innings beats a reckless one.
        </Text>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={saving ? 'Creating…' : 'Create & set up'} onPress={create} disabled={saving} style={{ marginTop: space.md }} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  note: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: space.md },
  error: { color: colors.red, marginTop: space.sm },
});
