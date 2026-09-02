import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/player_controller.dart';
import '../../application/providers.dart';
import '../../data/download_store.dart';
import '../../domain/track.dart';
import '../theme/tokens.dart';
import '../widgets/cover_art.dart';
import 'onboarding_screen.dart';

List<Map<String, dynamic>> _asMaps(dynamic raw) {
  final list = raw is List ? raw : const [];
  final out = <Map<String, dynamic>>[];
  for (final row in list) {
    if (row is Map<String, dynamic>) {
      out.add(row);
    } else if (row is Map) {
      out.add(Map<String, dynamic>.from(row));
    }
  }
  return out;
}

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  static Future<void> _play(
    BuildContext context,
    WidgetRef ref,
    TrackSummary track,
  ) async {
    final local = ref.read(downloadStoreProvider).completed(track.id);
    if (local != null) {
      await ref
          .read(playerControllerProvider)
          .playTrack(track: track, url: local.path);
      if (context.mounted) {
        context.push('/player');
      }
      return;
    }
    if (context.mounted) {
      context.push('/track/${track.id}');
    }
  }

  static Future<void> _playAll(
    BuildContext context,
    WidgetRef ref,
    List<TrackSummary> tracks,
  ) async {
    if (tracks.isEmpty) {
      return;
    }
    await _play(context, ref, tracks.first);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final home = ref.watch(homeProvider);
    return home.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _EmptyHome(onExplore: () => context.go('/discover')),
      data: (data) {
        final recents = TrackSummary.listFrom(
          data['recentlyPlayed'] ?? data['continueListening'],
        );
        final recommended = TrackSummary.listFrom(data['recommended']);
        final trending = TrackSummary.listFrom(data['trending']);
        final fresh = TrackSummary.listFrom(data['newOpenReleases']);
        final downloadable = TrackSummary.listFrom(data['downloadable']);
        final firstCollection = TrackSummary.listFrom(data['firstCollection']);
        final becauseYouLike = _asMaps(data['becauseYouLike']);
        final languageShelves = _asMaps(data['languageShelves']);
        final categoryShelves = _asMaps(data['categoryShelves']);
        final favoriteArtists = _asMaps(data['favoriteArtists']);
        final saved = ref.watch(downloadStoreProvider).libraryTracks();
        final genres = _asMaps(data['genres'])
            .map((row) => row['name'] as String? ?? '')
            .where((name) => name.isNotEmpty)
            .toList();
        final playlists = _asMaps(data['communityPlaylists']);
        final hero = firstCollection.isNotEmpty
            ? firstCollection.first
            : recommended.isNotEmpty
            ? recommended.first
            : trending.isNotEmpty
            ? trending.first
            : saved.isNotEmpty
            ? saved.first
            : null;
        final empty =
            hero == null &&
            recommended.isEmpty &&
            trending.isEmpty &&
            recents.isEmpty &&
            saved.isEmpty &&
            firstCollection.isEmpty;
        final seen = <String>{if (hero != null) hero.id};
        List<TrackSummary> unique(List<TrackSummary> tracks) {
          final out = <TrackSummary>[];
          for (final track in tracks) {
            if (seen.add(track.id)) {
              out.add(track);
            }
          }
          return out;
        }

        return SafeArea(
          bottom: false,
          child: CustomScrollView(
            cacheExtent: 1200,
            slivers: [
              SliverToBoxAdapter(
                child: _Header(
                  greeting: data['greeting'] as String? ?? 'OpenTune',
                  subtitle: empty
                      ? ''
                      : data['subtitle'] as String? ??
                            "Here's something you'll love.",
                ),
              ),
              const SliverToBoxAdapter(child: StarterPackBanner()),
              if (empty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _EmptyHome(onExplore: () => context.go('/discover')),
                )
              else ...[
                if (hero != null)
                  SliverToBoxAdapter(
                    child: _HeroCard(
                      track: hero,
                      onPlay: () => _play(context, ref, hero),
                      onOpen: () => context.push('/track/${hero.id}'),
                    ),
                  ),
                if (genres.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _GenreRow(
                      genres: genres,
                      onTap: (genre) {
                        ref.read(discoverQueryProvider.notifier).state = genre;
                        context.go('/discover');
                      },
                    ),
                  ),
                if (languageShelves.isNotEmpty || categoryShelves.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _MoodStrip(
                      languages: languageShelves,
                      categories: categoryShelves,
                      onQuery: (query) {
                        ref.read(discoverQueryProvider.notifier).state = query;
                        context.go('/discover');
                      },
                    ),
                  ),
                if (firstCollection.length > 1)
                  _rail(
                    title: 'Made for you',
                    action: 'Play all',
                    onAction: () => _playAll(context, ref, firstCollection),
                    tracks: unique(firstCollection),
                  ),
                _rail(title: 'Continue', tracks: unique(recents)),
                _rail(title: 'For you', tracks: recommended),
                for (final row in becauseYouLike)
                  _rail(
                    title:
                        row['title'] as String? ?? 'Based on artists you like',
                    tracks: unique(TrackSummary.listFrom(row['tracks'])),
                  ),
                if (favoriteArtists.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _ArtistRail(artists: favoriteArtists),
                  ),
                _rail(title: 'Saved', tracks: saved),
                _rail(title: 'Trending now', tracks: unique(trending)),
                _rail(title: 'New this week', tracks: unique(fresh)),
                _rail(title: 'Worth keeping', tracks: unique(downloadable)),
                if (playlists.isNotEmpty)
                  SliverToBoxAdapter(
                    child: _PlaylistRail(playlists: playlists),
                  ),
                const SliverToBoxAdapter(child: SizedBox(height: 32)),
              ],
            ],
          ),
        );
      },
    );
  }

  static Widget _rail({
    required String title,
    required List<TrackSummary> tracks,
    String? action,
    VoidCallback? onAction,
  }) {
    if (tracks.isEmpty) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }
    return SliverToBoxAdapter(
      child: _TrackRail(
        title: title,
        tracks: tracks.take(12).toList(),
        action: action,
        onAction: onAction,
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.greeting, required this.subtitle});

  final String greeting;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            greeting,
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w700,
              letterSpacing: -0.8,
            ),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.white.withValues(alpha: 0.72),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.track,
    required this.onPlay,
    required this.onOpen,
  });

  final TrackSummary track;
  final VoidCallback onPlay;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final height = (MediaQuery.sizeOf(context).height * 0.36).clamp(
      220.0,
      300.0,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
      child: GestureDetector(
        onTap: onOpen,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: SizedBox(
            height: height,
            child: Stack(
              fit: StackFit.expand,
              children: [
                CoverArt(
                  url: track.artworkUrl,
                  size: height,
                  radius: 0,
                  hero: true,
                ),
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.05),
                        Colors.black.withValues(alpha: 0.82),
                      ],
                    ),
                  ),
                ),
                Positioned(
                  left: 20,
                  right: 20,
                  bottom: 20,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        track.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        track.artistName ?? 'Unknown artist',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(color: Colors.white70),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Align(
                            alignment: Alignment.centerLeft,
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(
                                minimumSize: const Size(128, 48),
                                maximumSize: const Size(180, 48),
                                backgroundColor: OpenTuneTokens.teal,
                                foregroundColor: OpenTuneTokens.night,
                              ),
                              onPressed: onPlay,
                              icon: const Icon(Icons.play_arrow_rounded),
                              label: const Text('Play'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          IconButton.filledTonal(
                            onPressed: onOpen,
                            icon: const Icon(Icons.more_horiz),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TrackRail extends StatelessWidget {
  const _TrackRail({
    required this.title,
    required this.tracks,
    this.action,
    this.onAction,
  });

  final String title;
  final List<TrackSummary> tracks;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 8, 12),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (action != null && onAction != null)
                  TextButton(onPressed: onAction, child: Text(action!)),
              ],
            ),
          ),
          SizedBox(
            height: 196,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: tracks.length,
              separatorBuilder: (_, _) => const SizedBox(width: 14),
              itemBuilder: (context, index) {
                return _AlbumCard(track: tracks[index]);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AlbumCard extends ConsumerWidget {
  const _AlbumCard({required this.track});

  final TrackSummary track;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      width: 140,
      child: InkWell(
        onTap: () => HomeScreen._play(context, ref, track),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                CoverArt(url: track.artworkUrl, size: 140, radius: 18),
                Positioned(
                  right: 8,
                  bottom: 8,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: OpenTuneTokens.teal,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Padding(
                      padding: EdgeInsets.all(6),
                      child: Icon(
                        Icons.play_arrow_rounded,
                        color: OpenTuneTokens.night,
                        size: 22,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              track.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
            ),
            Text(
              track.artistName ?? '',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: Colors.white60),
            ),
          ],
        ),
      ),
    );
  }
}

class _ArtistRail extends StatelessWidget {
  const _ArtistRail({required this.artists});

  final List<dynamic> artists;

  @override
  Widget build(BuildContext context) {
    final rows = _asMaps(artists);
    if (rows.isEmpty) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Text(
              'Artists you love',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          SizedBox(
            height: 108,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: rows.length,
              separatorBuilder: (_, _) => const SizedBox(width: 16),
              itemBuilder: (context, index) {
                final row = rows[index];
                final id = row['id'] as String?;
                return InkWell(
                  onTap: id == null ? null : () => context.push('/artist/$id'),
                  child: SizedBox(
                    width: 76,
                    child: Column(
                      children: [
                        CoverArt(
                          url: row['artworkUrl'] as String?,
                          size: 72,
                          radius: 36,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          row['name'] as String? ?? '',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _MoodStrip extends StatelessWidget {
  const _MoodStrip({
    required this.languages,
    required this.categories,
    required this.onQuery,
  });

  final List<dynamic> languages;
  final List<dynamic> categories;
  final void Function(String query) onQuery;

  @override
  Widget build(BuildContext context) {
    final chips = <(String, String)>[];
    for (final row in _asMaps(languages)) {
      final nested = row['language'];
      final name = nested is Map
          ? (Map<String, dynamic>.from(nested)['name'] as String? ?? '')
          : row['title'] as String? ?? '';
      if (name.isNotEmpty) {
        chips.add((name, name));
      }
    }
    for (final row in _asMaps(categories)) {
      final nested = row['category'];
      final name = nested is Map
          ? (Map<String, dynamic>.from(nested)['name'] as String? ?? '')
          : row['title'] as String? ?? '';
      if (name.isNotEmpty) {
        chips.add((name, name));
      }
    }
    if (chips.isEmpty) {
      return const SizedBox.shrink();
    }
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        itemCount: chips.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final chip = chips[index];
          return ActionChip(
            label: Text(chip.$1),
            onPressed: () => onQuery(chip.$2),
          );
        },
      ),
    );
  }
}

class _GenreRow extends StatelessWidget {
  const _GenreRow({required this.genres, required this.onTap});

  final List<String> genres;
  final void Function(String genre) onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        itemCount: genres.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final genre = genres[index];
          return ActionChip(label: Text(genre), onPressed: () => onTap(genre));
        },
      ),
    );
  }
}

class _PlaylistRail extends StatelessWidget {
  const _PlaylistRail({required this.playlists});

  final List<dynamic> playlists;

  @override
  Widget build(BuildContext context) {
    final rows = _asMaps(playlists);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'From the community',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          for (final playlist in rows)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const CoverArt(size: 48, radius: 10),
              title: Text(playlist['title'] as String? ?? 'Playlist'),
              onTap: () => context.push('/playlist/${playlist['id']}'),
            ),
        ],
      ),
    );
  }
}

class _EmptyHome extends StatelessWidget {
  const _EmptyHome({required this.onExplore});

  final VoidCallback onExplore;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CoverArt(size: 120, radius: 28),
          const SizedBox(height: 24),
          Text('Press play', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Explore licensed music and we’ll build your mix.',
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 24),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(180, 48)),
            onPressed: onExplore,
            child: const Text('Explore'),
          ),
        ],
      ),
    );
  }
}
