import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/providers.dart';
import '../../data/api_client.dart';
import '../../data/download_store.dart';
import '../../data/offline_store.dart';
import '../../data/taste_store.dart';
import '../../domain/scenes.dart';
import '../../domain/track.dart';
import '../theme/tokens.dart';
import '../widgets/cover_art.dart';
import '../widgets/empty_state.dart';
import '../widgets/offline_banner.dart';
import '../widgets/song_row.dart';

enum _DiscoverTab { songs, artists }

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _controller = TextEditingController();
  List<TrackSummary> _results = [];
  List<TrackSummary> _trending = [];
  MusicScene? _scene;
  YearFilter _year = discoverYearFilters.first;
  _DiscoverTab _tab = _DiscoverTab.songs;
  bool _loading = false;
  bool _searched = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadBrowse();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadBrowse() async {
    if (ref.read(offlineStoreProvider).offline) {
      if (!mounted) {
        return;
      }
      setState(() {
        _trending = ref.read(downloadStoreProvider).libraryTracks();
      });
      return;
    }
    final trending = await ref.read(apiClientProvider).trending();
    if (!mounted) {
      return;
    }
    setState(() => _trending = trending);
  }

  (int?, int?) _yearRange(String raw) {
    final text = raw.trim();
    if (RegExp(r'^\d{4}$').hasMatch(text)) {
      final year = int.parse(text);
      return (year, year);
    }
    if (RegExp(r'^\d{4}s$').hasMatch(text)) {
      final start = int.parse(text.substring(0, 4));
      return (start, start + 9);
    }
    return (_year.from, _year.to);
  }

  Future<void> _search([String? query, MusicScene? scene]) async {
    final raw = (query ?? _controller.text).trim();
    final yearFromQuery = _yearRange(raw);
    final isYearOnly = RegExp(r'^\d{4}s?$').hasMatch(raw);
    final q = isYearOnly ? (scene?.searchQuery ?? '') : raw;
    if (q.isEmpty && yearFromQuery.$1 == null && scene == null) {
      setState(() {
        _searched = false;
        _results = [];
        _error = null;
        _scene = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _searched = true;
      _scene = scene ?? _scene;
      if (!isYearOnly && raw.isNotEmpty) {
        _controller.text = raw;
      }
    });
    try {
      var results = <TrackSummary>[];
      if (ref.read(offlineStoreProvider).offline) {
        results = ref.read(downloadStoreProvider).searchLibrary(q);
      } else {
        results = await ref
            .read(apiClientProvider)
            .search(
              q.isEmpty ? (scene?.searchQuery ?? '') : q,
              yearFrom: yearFromQuery.$1,
              yearTo: yearFromQuery.$2,
            );
        final fallback = (scene ?? _scene)?.fallbackQuery;
        if (results.isEmpty &&
            fallback != null &&
            fallback.isNotEmpty &&
            fallback != q) {
          results = await ref
              .read(apiClientProvider)
              .search(
                fallback,
                yearFrom: yearFromQuery.$1,
                yearTo: yearFromQuery.$2,
              );
        }
      }
      if (!mounted) {
        return;
      }
      setState(() => _results = results);
      ref
          .read(tasteStoreProvider)
          .rememberSearch(
            query: q.isEmpty ? (scene?.name ?? 'this mix') : q,
            scene: scene?.name,
            tracks: results,
          );
    } catch (_) {
      ref.read(offlineStoreProvider).enterOffline();
      final local = ref.read(downloadStoreProvider).searchLibrary(q);
      if (!mounted) {
        return;
      }
      setState(() {
        _results = local;
        _error = local.isEmpty
            ? 'Search needs a network connection to the OpenTune API.'
            : 'Offline — searching music saved on this device.';
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _openScene(MusicScene scene) {
    _controller.clear();
    _search(scene.searchQuery, scene);
  }

  List<_ArtistHit> get _artists {
    final seen = <String>{};
    final artists = <_ArtistHit>[];
    for (final track in _results) {
      final key = track.artistId ?? track.artistName ?? '';
      if (key.isEmpty || !seen.add(key)) {
        continue;
      }
      artists.add(
        _ArtistHit(
          id: track.artistId,
          name: track.artistName ?? 'Unknown artist',
          artworkUrl: track.artworkUrl,
        ),
      );
    }
    return artists;
  }

  @override
  Widget build(BuildContext context) {
    final seeded = ref.watch(discoverQueryProvider);
    if (seeded != null && seeded.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) {
          return;
        }
        if (ref.read(discoverQueryProvider) != seeded) {
          return;
        }
        ref.read(discoverQueryProvider.notifier).state = null;
        _search(seeded);
      });
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(_scene?.name ?? 'Discover'),
        leading: _scene != null || _searched
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  setState(() {
                    _scene = null;
                    _searched = false;
                    _results = [];
                    _controller.clear();
                    _tab = _DiscoverTab.songs;
                  });
                },
              )
            : null,
      ),
      body: Column(
        children: [
          if (ref.watch(offlineStoreProvider).offline)
            const OfflineBanner(
              message:
                  'Offline mode — search is limited to music saved on this device.',
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: 'Songs, singers, or a year',
                suffixIcon: IconButton(
                  onPressed: _search,
                  icon: const Icon(Icons.search),
                ),
              ),
              onSubmitted: _search,
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: discoverYearFilters.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final filter = discoverYearFilters[index];
                return ChoiceChip(
                  label: Text(filter.label),
                  selected: _year.label == filter.label,
                  onSelected: (_) {
                    setState(() => _year = filter);
                    if (_searched || _scene != null) {
                      _search(_controller.text, _scene);
                    }
                  },
                );
              },
            ),
          ),
          if (_searched)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('Songs'),
                    selected: _tab == _DiscoverTab.songs,
                    onSelected: (_) {
                      setState(() => _tab = _DiscoverTab.songs);
                    },
                  ),
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: const Text('Singers'),
                    selected: _tab == _DiscoverTab.artists,
                    onSelected: (_) {
                      setState(() => _tab = _DiscoverTab.artists);
                    },
                  ),
                ],
              ),
            ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(OpenTuneTokens.spaceMd),
              child: Text(_error!),
            ),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() {
    if (_searched) {
      if (_tab == _DiscoverTab.artists) {
        if (_artists.isEmpty && !_loading) {
          return const EmptyState(
            title: 'No singers yet',
            message: 'Try another scene, singer, or year.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          itemCount: _artists.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final artist = _artists[index];
            return ListTile(
              leading: CoverArt(url: artist.artworkUrl, size: 52, radius: 26),
              title: Text(artist.name),
              onTap: artist.id == null
                  ? null
                  : () => context.push('/artist/${artist.id}'),
            );
          },
        );
      }
      if (_results.isEmpty && !_loading) {
        return const EmptyState(
          title: 'No matches',
          message: 'Try another scene, singer, or year.',
        );
      }
      final label = _results.length == 1
          ? '1 song'
          : '${_results.length} songs';
      return ListView.builder(
        padding: const EdgeInsets.only(bottom: 24),
        itemCount: _results.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
              child: Text(
                label,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            );
          }
          final track = _results[index - 1];
          return SongRow(index: index, track: track, mix: _results);
        },
      );
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        for (final group in discoverSceneGroups) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
            child: Text(
              group.title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: group.scenes.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.35,
              ),
              itemBuilder: (context, index) {
                final scene = group.scenes[index];
                return _SceneTile(scene: scene, onTap: () => _openScene(scene));
              },
            ),
          ),
        ],
        if (_trending.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 8),
            child: Text(
              'Trending now',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          for (var i = 0; i < _trending.take(6).length; i++)
            SongRow(
              index: i + 1,
              track: _trending[i],
              mix: _trending.take(6).toList(),
            ),
        ],
      ],
    );
  }
}

class _ArtistHit {
  const _ArtistHit({this.id, required this.name, this.artworkUrl});

  final String? id;
  final String name;
  final String? artworkUrl;
}

class _SceneTile extends StatelessWidget {
  const _SceneTile({required this.scene, required this.onTap});

  final MusicScene scene;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: scene.colors,
            ),
          ),
          child: Stack(
            children: [
              Positioned(
                right: -18,
                bottom: -22,
                child: Icon(
                  scene.icon,
                  size: 88,
                  color: Colors.white.withValues(alpha: 0.18),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(scene.icon, color: Colors.white, size: 22),
                    const Spacer(),
                    Text(
                      scene.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
