import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/player_controller.dart';
import '../../data/api_client.dart';
import '../../data/download_store.dart';
import '../../data/offline_store.dart';
import '../../domain/track.dart';
import '../widgets/empty_state.dart';
import '../widgets/track_tile.dart';

class ArtistScreen extends ConsumerStatefulWidget {
  const ArtistScreen({super.key, required this.artistId});
  final String artistId;

  @override
  ConsumerState<ArtistScreen> createState() => _ArtistScreenState();
}

class _ArtistScreenState extends ConsumerState<ArtistScreen> {
  Map<String, dynamic>? data;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await ref.read(apiClientProvider).artist(widget.artistId);
      if (mounted) {
        setState(() => data = result);
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Artist not found.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Artist')),
        body: Center(child: Text(error!)),
      );
    }
    if (data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final albums = (data?['albums'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final tracks = TrackSummary.listFrom(data?['tracks']);
    return Scaffold(
      appBar: AppBar(title: Text(data?['name'] as String? ?? 'Artist')),
      body: ListView(
        children: [
          _Artwork(url: data?['artworkUrl'] as String?),
          if ((data?['bio'] as String?) != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(data?['bio'] as String? ?? ''),
            ),
          if (albums.isNotEmpty) ...[
            const ListTile(title: Text('Albums')),
            for (final album in albums)
              ListTile(
                leading: const Icon(Icons.album_outlined),
                title: Text(album['title'] as String? ?? 'Album'),
                onTap: () {
                  final id = album['id'] as String?;
                  if (id != null) {
                    context.push('/album/$id');
                  }
                },
              ),
          ],
          const ListTile(title: Text('Tracks')),
          if (tracks.isEmpty)
            const EmptyState(
              title: 'No tracks',
              message: 'This artist has no catalog references yet.',
            )
          else
            for (final track in tracks) TrackTile(track: track),
        ],
      ),
    );
  }
}

class AlbumScreen extends ConsumerStatefulWidget {
  const AlbumScreen({super.key, required this.albumId});
  final String albumId;

  @override
  ConsumerState<AlbumScreen> createState() => _AlbumScreenState();
}

class _AlbumScreenState extends ConsumerState<AlbumScreen> {
  Map<String, dynamic>? data;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await ref.read(apiClientProvider).album(widget.albumId);
      if (mounted) {
        setState(() => data = result);
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Album not found.');
      }
    }
  }

  Future<void> _playAll() async {
    final api = ref.read(apiClientProvider);
    final downloads = ref.read(downloadStoreProvider);
    final disconnected = ref.read(offlineStoreProvider).offline;
    final tracks = TrackSummary.listFrom(data?['tracks']);
    final items = <QueuedItem>[];
    for (final track in tracks) {
      final local = downloads.completed(track.id);
      if (local != null) {
        items.add(
          QueuedItem(
            track: track,
            url: local.path,
            license: local.license,
            attribution: local.attribution,
            localFile: true,
          ),
        );
        continue;
      }
      if (disconnected) {
        continue;
      }
      try {
        final sources = await api.trackSources(track.id);
        final list = sources['sources'] as List<dynamic>? ?? [];
        if (list.isEmpty) {
          continue;
        }
        final source = list.first as Map<String, dynamic>;
        final url = source['playbackUrl'] as String?;
        if (url == null) {
          continue;
        }
        final license = source['license'] as Map<String, dynamic>?;
        items.add(
          QueuedItem(
            track: track,
            url: url,
            license: license?['spdxId'] as String? ?? track.spdxId,
            attribution: source['attributionText'] as String?,
            licenseUrl: license?['url'] as String?,
          ),
        );
      } catch (_) {}
    }
    if (items.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'No playable sources on this device or from providers.',
            ),
          ),
        );
      }
      return;
    }
    await ref
        .read(playerControllerProvider)
        .playTrack(
          track: items.first.track,
          url: items.first.url,
          license: items.first.license,
          attribution: items.first.attribution,
          licenseUrl: items.first.licenseUrl,
          newQueue: items,
        );
    if (mounted) {
      context.push('/player');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Album')),
        body: Center(child: Text(error!)),
      );
    }
    if (data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final artists = (data?['artists'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final tracks = TrackSummary.listFrom(data?['tracks']);
    return Scaffold(
      appBar: AppBar(title: Text(data?['title'] as String? ?? 'Album')),
      body: ListView(
        children: [
          _Artwork(url: data?['artworkUrl'] as String?),
          for (final artist in artists)
            ListTile(
              title: Text(artist['name'] as String? ?? 'Artist'),
              onTap: () {
                final id = artist['id'] as String?;
                if (id != null) {
                  context.push('/artist/$id');
                }
              },
            ),
          if (tracks.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: FilledButton.icon(
                onPressed: _playAll,
                icon: const Icon(Icons.play_arrow),
                label: const Text('Play all'),
              ),
            ),
          if (tracks.isEmpty)
            const EmptyState(
              title: 'No tracks',
              message: 'This album has no catalog references yet.',
            )
          else
            for (final track in tracks) TrackTile(track: track),
        ],
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({this.url});
  final String? url;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return const SizedBox(height: 8);
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: url!,
          height: 160,
          width: double.infinity,
          fit: BoxFit.cover,
        ),
      ),
    );
  }
}
