import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { TextInput } from '../components/TextField';
import { Chip, Screen, Txt } from '../components/ui';
import { searchLectures } from '../data/academy';
import { ago, searchPosts } from '../data/community';
import { getTeacherJobs, isOpen } from '../data/jobs';
import { regionByCode } from '../data/regions';
import { getNotices, searchSchools } from '../data/repository';
import { useAsync } from '../data/useAsync';
import { NOTICE_LABEL } from '../features/news/NoticeList';
import { useAppSettings, useToday } from '../store/AppSettings';
import { radius, space } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

type Cat = 'all' | 'school' | 'post' | 'notice' | 'lecture';
const CATS: { value: Cat; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'school', label: '학교' },
  { value: 'post', label: '게시글' },
  { value: 'notice', label: '공고' },
  { value: 'lecture', label: '강의' },
];
const PREVIEW = 4;
const KIND_LABEL = { e: '초등학교', m: '중학교', h: '고등학교' } as const;
const FOUND_LABEL = { p: '공립', s: '사립', n: '국립' } as const;
const has = (text: string, t: string) => text.replace(/\s/g, '').toLowerCase().includes(t);

// 통합 검색: 학교 · 게시글 · 공고(교육청 소식 + 학교별 채용) · 강의
export default function SearchScreen() {
  const { colors } = useTheme();
  const { viewLevel } = useAppSettings();
  const today = useToday();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const params = useLocalSearchParams<{ cat?: string }>();
  const [cat, setCat] = useState<Cat>(CATS.some((c) => c.value === params.cat) ? (params.cat as Cat) : 'all');

  // 다 칠 때까지 잠깐 기다렸다가 찾기
  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 350);
    return () => clearTimeout(id);
  }, [input]);
  const t = q.replace(/\s/g, '').toLowerCase();
  const ready = t.length >= 2;

  const want = (c: Cat) => ready && (cat === 'all' || cat === c);
  const schools = useAsync(() => (want('school') ? searchSchools(q) : Promise.resolve([])), [q, cat]);
  const posts = useAsync(() => (want('post') ? searchPosts(q) : Promise.resolve([])), [q, cat]);
  const lectures = useAsync(() => (want('lecture') ? searchLectures(viewLevel, q) : Promise.resolve([])), [q, cat, viewLevel]);
  const noticesAll = useAsync(() => (want('notice') ? getNotices(viewLevel, 300) : Promise.resolve([])), [cat, viewLevel, ready]);
  const jobsAll = useAsync(() => (want('notice') ? getTeacherJobs() : Promise.resolve([])), [cat, ready]);

  const notices = useMemo(() => {
    if (!ready) return [];
    const ns = (noticesAll.data ?? [])
      .filter((n) => has(n.title, t) || has(regionByCode(n.region)?.shortName ?? '', t))
      .map((n) => ({ key: n.url, url: n.url, title: n.title, badge: NOTICE_LABEL[n.docType], region: n.region, date: n.postedAt, closed: false }));
    const js = (jobsAll.data ?? [])
      .filter((j) => (!j.level || j.level === viewLevel) && (has(j.title, t) || has(j.org, t)))
      .map((j) => ({ key: j.id, url: j.url, title: j.title, badge: '학교별 채용', region: j.region, date: j.posted, closed: !isOpen(j, today) }));
    return [...js, ...ns].sort((a, b) => Number(a.closed) - Number(b.closed) || ((b.date ?? '') > (a.date ?? '') ? 1 : -1));
  }, [noticesAll.data, jobsAll.data, t, ready, viewLevel, today]);

  const loading = schools.loading || posts.loading || lectures.loading || noticesAll.loading || jobsAll.loading;
  const counts = {
    school: schools.data?.length ?? 0,
    post: posts.data?.length ?? 0,
    notice: notices.length,
    lecture: lectures.data?.length ?? 0,
  };
  const total = counts.school + counts.post + counts.notice + counts.lecture;
  const limit = (n: number) => (cat === 'all' ? Math.min(n, PREVIEW) : n);

  const Row = ({ onPress, children, link }: { onPress: () => void; children: ReactNode; link?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole={link ? 'link' : 'button'}
      style={({ pressed }) => ({
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        gap: 2,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: pressed ? colors.surface : 'transparent',
      })}
    >
      {children}
    </Pressable>
  );
  const Section = ({ c, title, icon, n, children }: { c: Exclude<Cat, 'all'>; title: string; icon: keyof typeof Ionicons.glyphMap; n: number; children: ReactNode }) =>
    n === 0 ? null : (
      <View style={{ borderRadius: radius.xl, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg, paddingBottom: space.sm }}>
          <Ionicons name={icon} size={18} color={colors.brand} />
          <Txt variant="heading" style={{ flex: 1 }}>
            {title} {n}
            {n >= 30 && c !== 'notice' ? '+' : ''}
          </Txt>
        </View>
        {children}
        {cat === 'all' && n > PREVIEW && (
          <Txt color="brand" style={{ fontWeight: '800', padding: space.lg, paddingTop: space.sm }} onPress={() => setCat(c)}>
            {title} 더 보기 ›
          </Txt>
        )}
      </View>
    );

  return (
    <>
      <Stack.Screen options={{ title: '검색' }} />
      <Screen>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.sm,
            paddingHorizontal: space.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textSub} />
          <TextInput
            value={input}
            onChangeText={setInput}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => setQ(input.trim())}
            placeholder="학교, 글, 공고, 강의·강사 이름"
            placeholderTextColor={colors.textSub}
            accessibilityLabel="검색어"
            style={{ flex: 1, paddingVertical: space.md, color: colors.text, fontSize: 16 }}
          />
          {input.length > 0 && (
            <Pressable onPress={() => setInput('')} hitSlop={10} accessibilityLabel="검색어 지우기">
              <Ionicons name="close-circle" size={18} color={colors.textSub} />
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CATS.map((c) => (
            <Chip
              key={c.value}
              label={ready && c.value !== 'all' && cat === 'all' ? `${c.label} ${counts[c.value]}` : c.label}
              selected={cat === c.value}
              onPress={() => setCat(c.value)}
            />
          ))}
        </View>

        {!ready ? (
          <Txt variant="sub">
            두 글자 이상 입력해 주세요. 공고·강의는 지금 보고 있는 {viewLevel === 'elementary' ? '초등' : '중등'} 기준으로 찾아요.
          </Txt>
        ) : loading && total === 0 ? (
          <ActivityIndicator color={colors.brand} />
        ) : total === 0 ? (
          <Txt variant="sub">"{q}"에 맞는 결과가 없어요. 다른 낱말로 찾아보세요.</Txt>
        ) : null}

        {ready && (
          <>
            <Section c="school" title="학교" icon="school-outline" n={counts.school}>
              {(schools.data ?? []).slice(0, limit(counts.school)).map((s) => (
                <Row
                  key={`${s.region}:${s.name}:${s.kind}`}
                  onPress={() =>
                    router.push({
                      pathname: '/schools',
                      params: { region: s.region, level: s.kind === 'e' ? 'elementary' : 'secondary', q: s.name },
                    })
                  }
                >
                  <Txt style={{ fontWeight: '700' }}>{s.name}</Txt>
                  <Txt variant="sub">
                    {regionByCode(s.region)?.shortName} {s.sigungu} · {FOUND_LABEL[s.found]} {KIND_LABEL[s.kind]}
                  </Txt>
                </Row>
              ))}
            </Section>

            <Section c="post" title="게시글" icon="chatbubbles-outline" n={counts.post}>
              {(posts.data ?? []).slice(0, limit(counts.post)).map((p) => (
                <Row key={p.id} onPress={() => router.push(`/community/${p.id}`)}>
                  <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                    {p.title}
                  </Txt>
                  <Txt variant="sub" numberOfLines={1}>
                    {p.boardName} · {p.label} · {ago(p.createdAt)} · 공감 {p.likeCount} · 댓글 {p.commentCount}
                  </Txt>
                </Row>
              ))}
            </Section>

            <Section c="notice" title="공고" icon="megaphone-outline" n={counts.notice}>
              {notices.slice(0, limit(counts.notice)).map((n) => (
                <Row key={n.key} link onPress={() => Linking.openURL(n.url)}>
                  <Txt variant="sub" style={{ fontWeight: '700' }}>
                    {n.badge}
                    {n.region ? ` · ${regionByCode(n.region)?.shortName ?? ''}` : ''}
                    {n.date ? ` · ${n.date.slice(2).replace(/-/g, '.')}` : ''}
                    {n.closed ? ' · 마감' : ''}
                  </Txt>
                  <Txt style={{ fontWeight: '700', opacity: n.closed ? 0.55 : 1 }} numberOfLines={2}>
                    {n.title}
                  </Txt>
                </Row>
              ))}
            </Section>

            <Section c="lecture" title="강의" icon="play-circle-outline" n={counts.lecture}>
              {(lectures.data ?? []).slice(0, limit(counts.lecture)).map((l) => (
                <Row key={l.id} onPress={() => router.push(`/lecture/${l.id}`)}>
                  <Txt style={{ fontWeight: '700' }} numberOfLines={1}>
                    {l.title}
                  </Txt>
                  <Txt variant="sub" numberOfLines={1}>
                    {l.academyName} · {l.instructor}
                    {l.reviewCount ? ` · ★ ${l.ratingAvg?.toFixed(1)} (${l.reviewCount})` : ' · 후기 없음'}
                  </Txt>
                </Row>
              ))}
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}
