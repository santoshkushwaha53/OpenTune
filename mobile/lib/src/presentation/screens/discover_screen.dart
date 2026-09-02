import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../data/api_client.dart';
import '../../data/download_store.dart';
import '../../data/offline_store.dart';
import '../../domain/track.dart';
import '../theme/tokens.dart';
import '../widgets/empty_state.dart';
import '../widgets/offline_banner.dart';
import '../widgets/track_tile.dart';

class DiscoverScreen extends ConsumerStatefulWidget {
  const DiscoverScreen({super.key});

  @override
  ConsumerState<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends ConsumerState<DiscoverScreen> {
  final _controller = TextEditingController();
  List<TrackSummary> _results = [];
  List<TrackSummary> _trending = [];
  List<String> _genres = [];
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
        _genres = [];
      });
      return;
    }
    final api = ref.read(apiClientProvider);
    final trending = await api.trending();
    final genres = await api.genres();
    if (!mounted) {
      return;
    }
    setState(() {
      _trending = trending;
      _genres = genres;
    });
  }

  Future<void> _search([String? query]) async {
    final q = (query ?? _controller.text).trim();
    if (q.isEmpty) {
      setState(() {
        _searched = false;
        _results = [];
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _searched = true;
      _controller.text = q;
    });
    try {
      final List<TrackSummary> results;
      if (ref.read(offlineStoreProvider).offline) {
        results = ref.read(downloadStoreProvider).searchLibrary(q);
      } else {
        results = await ref.read(apiClientProvider).search(q);
      }
      if (!mounted) {
        return;
      }
      setState(() => _results = results);
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
      appBar: AppBar(title: const Text('Discover')),
      body: Column(
        children: [
          if (ref.watch(offlineStoreProvider).offline)
            const OfflineBanner(
              message:
                  'Offline mode — search is limited to music saved on this device.',
            ),
          Padding(
            padding: const EdgeInsets.all(OpenTuneTokens.spaceMd),
            child: TextField(
              controller: _controller,
              decoration: InputDecoration(
                hintText: 'Search open music',
                suffixIcon: IconButton(
                  onPressed: _search,
                  icon: const Icon(Icons.search),
                ),
              ),
              onSubmitted: _search,
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
      if (_results.isEmpty && !_loading) {
        return const EmptyState(
          title: 'No matches',
          message:
              'Try another query. Downloads only appear when the provider allows them.',
        );
      }
      return ListView.builder(
        itemCount: _results.length,
        itemBuilder: (context, index) => TrackTile(track: _results[index]),
      );
    }

    if (_trending.isEmpty && _genres.isEmpty) {
      return const EmptyState(
        title: 'Find licensed music',
        message:
            'Search Jamendo and other open catalogs. Downloads only appear when the provider allows them.',
      );
    }

    return ListView(
      children: [
        if (_genres.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: OpenTuneTokens.spaceMd,
            ),
            child: Wrap(
              spacing: 8,
              children: [
                for (final genre in _genres)
                  ActionChip(
                    label: Text(genre),
                    onPressed: () => _search(genre),
                  ),
              ],
            ),
          ),
        if (_trending.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              OpenTuneTokens.spaceLg,
              OpenTuneTokens.spaceMd,
              OpenTuneTokens.spaceLg,
              OpenTuneTokens.spaceSm,
            ),
            child: Text(
              'Trending',
              style: Theme.of(context).textTheme.titleLarge,
            ),
          ),
        for (final track in _trending) TrackTile(track: track),
      ],
    );
  }
}
