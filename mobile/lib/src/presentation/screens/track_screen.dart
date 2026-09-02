import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/player_controller.dart';
import '../../application/providers.dart';
import '../../data/api_client.dart';
import '../../data/download_store.dart';
import '../../data/offline_store.dart';
import '../../data/session_store.dart';
import '../../domain/track.dart';
import '../widgets/availability_badges.dart';
import '../widgets/license_sheet.dart';
import '../widgets/report_dialog.dart';
import 'playlist_screens.dart';

class TrackScreen extends ConsumerStatefulWidget {
  const TrackScreen({super.key, required this.trackId});

  final String trackId;

  @override
  ConsumerState<TrackScreen> createState() => _TrackScreenState();
}

class _TrackScreenState extends ConsumerState<TrackScreen> {
  Map<String, dynamic>? meta;
  Map<String, dynamic>? source;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final local = ref.read(downloadStoreProvider).completed(widget.trackId);
    final disconnected = ref.read(offlineStoreProvider).offline;
    try {
      if (!disconnected) {
        final api = ref.read(apiClientProvider);
        final track = await api.track(widget.trackId);
        final sources = await api.trackSources(widget.trackId);
        final list = sources['sources'] as List<dynamic>? ?? [];
        if (mounted) {
          setState(() {
            meta = track;
            source = list.isEmpty ? null : list.first as Map<String, dynamic>;
          });
        }
        return;
      }
    } catch (_) {
      ref.read(offlineStoreProvider).enterOffline();
    }
    if (local != null && mounted) {
      setState(() {
        meta = local.toTrackJson();
        source = {
          'attributionText': local.attribution,
          'license': {'spdxId': local.license},
        };
      });
      return;
    }
    if (mounted) {
      setState(() => error = 'Could not load this track.');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Track')),
        body: Center(child: Text(error!)),
      );
    }
    if (meta == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final license = source?['license'] as Map<String, dynamic>?;
    final artist = meta?['artist'] as Map<String, dynamic>?;
    final album = meta?['album'] as Map<String, dynamic>?;
    final track = TrackSummary.fromJson(meta!);
    final downloads = ref.watch(downloadStoreProvider);
    final offline = downloads.isOffline(widget.trackId);
    final disconnected = ref.watch(offlineStoreProvider).offline;
    final downloadRecord = downloads.items[widget.trackId];
    final downloading = downloadRecord?.state == DownloadState.downloading;
    final loggedIn = ref.watch(sessionStoreProvider).loggedIn;
    final favorited = _isFavorite(ref);
    return Scaffold(
      appBar: AppBar(title: Text(track.title)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          AvailabilityBadges(track: track, offline: offline),
          const SizedBox(height: 16),
          Text(
            source?['attributionText'] as String? ?? 'Attribution unavailable',
          ),
          Text(license?['name'] as String? ?? ''),
          Text(license?['spdxId'] as String? ?? ''),
          if (artist != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(artist['name'] as String? ?? 'Artist'),
              onTap: () => context.push('/artist/${artist['id']}'),
            ),
          if (album != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(album['title'] as String? ?? 'Album'),
              onTap: () => context.push('/album/${album['id']}'),
            ),
          const SizedBox(height: 12),
          if (offline)
            FilledButton(
              onPressed: () async {
                await ref
                    .read(playerControllerProvider)
                    .playTrack(
                      track: track,
                      url: 'https://example.invalid/offline',
                      license:
                          downloadRecord?.license ??
                          license?['spdxId'] as String?,
                      attribution:
                          downloadRecord?.attribution ??
                          source?['attributionText'] as String?,
                    );
                if (context.mounted) {
                  context.push('/player');
                }
              },
              child: const Text('Play from this device'),
            ),
          if (offline) const SizedBox(height: 8),
          FilledButton(
            onPressed: disconnected || source?['playbackUrl'] == null
                ? null
                : () async {
                    await ref
                        .read(playerControllerProvider)
                        .playTrack(
                          track: track,
                          url: source!['playbackUrl'] as String,
                          license: license?['spdxId'] as String?,
                          attribution: source?['attributionText'] as String?,
                          licenseUrl: license?['url'] as String?,
                        );
                    if (context.mounted) {
                      context.push('/player');
                    }
                  },
            child: const Text('Stream from provider'),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => showLicenseSheet(
              context,
              track: track,
              license: license?['spdxId'] as String?,
              attribution: source?['attributionText'] as String?,
              licenseUrl: license?['url'] as String?,
            ),
            child: const Text('License'),
          ),
          const SizedBox(height: 8),
          if (downloading)
            Column(
              children: [
                LinearProgressIndicator(
                  value: downloadRecord!.progress <= 0
                      ? null
                      : downloadRecord.progress,
                ),
                TextButton(
                  onPressed: () => downloads.cancel(widget.trackId),
                  child: const Text('Cancel download'),
                ),
              ],
            )
          else
            OutlinedButton(
              onPressed: offline || source?['downloadUrl'] == null
                  ? null
                  : () async {
                      try {
                        await downloads.enqueue(
                          trackId: widget.trackId,
                          title: track.title,
                          url: source!['downloadUrl'] as String,
                          permitted: true,
                          license: license?['spdxId'] as String?,
                          attribution: source?['attributionText'] as String?,
                          artistName: track.artistName,
                          artworkUrl: track.artworkUrl,
                          durationMs: track.durationMs,
                        );
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text(
                                'Saved on this device from the original provider URL',
                              ),
                            ),
                          );
                        }
                      } on DownloadRejected catch (error) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(error.message)),
                          );
                        }
                      }
                    },
              child: Text(offline ? 'Downloaded' : 'Download'),
            ),
          if (loggedIn) ...[
            TextButton(
              onPressed: () async {
                await ref
                    .read(apiClientProvider)
                    .setFavorite(widget.trackId, favorite: !favorited);
                ref.invalidate(libraryProvider);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        favorited
                            ? 'Removed from favorites'
                            : 'Added to favorites',
                      ),
                    ),
                  );
                }
              },
              child: Text(
                favorited ? 'Remove from favorites' : 'Add to favorites',
              ),
            ),
            TextButton(
              onPressed: () => _addToPlaylist(context, ref),
              child: const Text('Add to playlist'),
            ),
            TextButton(
              onPressed: () => showReportDialog(
                context,
                ref,
                entityType: 'track',
                entityId: widget.trackId,
              ),
              child: const Text('Report'),
            ),
          ],
        ],
      ),
    );
  }

  bool _isFavorite(WidgetRef ref) {
    return ref
        .watch(libraryProvider)
        .maybeWhen(
          data: (data) {
            final favorites = data['favorites'] as List<dynamic>? ?? [];
            return favorites.whereType<Map<String, dynamic>>().any((row) {
              return trackIdFromRow(row) == widget.trackId;
            });
          },
          orElse: () => false,
        );
  }

  Future<void> _addToPlaylist(BuildContext context, WidgetRef ref) async {
    final library = await ref.read(libraryProvider.future);
    if (!context.mounted) {
      return;
    }
    final playlists = (library['playlists'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    if (playlists.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Create a playlist from Library first.')),
      );
      return;
    }
    final playlistId = await showModalBottomSheet<String>(
      context: context,
      builder: (context) => ListView(
        children: [
          const ListTile(title: Text('Add to playlist')),
          for (final raw in playlists)
            ListTile(
              title: Text(raw['title'] as String? ?? 'Playlist'),
              onTap: () => Navigator.pop(context, raw['id'] as String?),
            ),
        ],
      ),
    );
    if (playlistId == null || !context.mounted) {
      return;
    }
    await ref
        .read(apiClientProvider)
        .addPlaylistTrack(playlistId, widget.trackId);
    ref.invalidate(libraryProvider);
    if (context.mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Added to playlist')));
    }
  }
}
