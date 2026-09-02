import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/player_controller.dart';
import '../../application/providers.dart';
import '../../data/api_client.dart';
import '../../data/download_store.dart';
import '../../data/offline_store.dart';
import '../../data/session_store.dart';
import '../../domain/track.dart';
import '../widgets/empty_state.dart';
import '../widgets/report_dialog.dart';
import '../widgets/track_tile.dart';

TrackSummary? trackFromLibraryRow(Map<String, dynamic> raw) {
  final nested = raw['track'];
  if (nested is Map<String, dynamic> && nested['id'] is String) {
    return TrackSummary.fromJson(nested);
  }
  return null;
}

String? trackIdFromRow(Map<String, dynamic> raw) {
  return trackFromLibraryRow(raw)?.id ?? raw['trackId'] as String?;
}

Future<void> showCreatePlaylistDialog(
  BuildContext context,
  WidgetRef ref,
) async {
  final controller = TextEditingController();
  final title = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('New playlist'),
      content: TextField(
        controller: controller,
        autofocus: true,
        decoration: const InputDecoration(labelText: 'Title'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('Create'),
        ),
      ],
    ),
  );
  if (title == null || title.isEmpty) {
    return;
  }
  try {
    final created = await ref.read(apiClientProvider).createPlaylist(title);
    ref.invalidate(libraryProvider);
    if (context.mounted) {
      context.push('/playlist/${created['id']}');
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not create playlist. Sign in and try again.'),
        ),
      );
    }
  }
}

class PlaylistsScreen extends ConsumerWidget {
  const PlaylistsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(libraryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Playlists')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => showCreatePlaylistDialog(context, ref),
        child: const Icon(Icons.add),
      ),
      body: library.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => const EmptyState(
          title: 'Sign in required',
          message: 'Playlists sync through your OpenTune account.',
        ),
        data: (data) {
          final playlists = data['playlists'] as List<dynamic>? ?? [];
          if (playlists.isEmpty) {
            return const EmptyState(
              title: 'No playlists',
              message:
                  'Create a playlist of track references. Audio is never copied.',
            );
          }
          return ListView(
            children: [
              for (final raw in playlists.whereType<Map<String, dynamic>>())
                ListTile(
                  title: Text(raw['title'] as String? ?? 'Playlist'),
                  subtitle: Text(raw['visibility'] as String? ?? 'private'),
                  onTap: () => context.push('/playlist/${raw['id']}'),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      final id = raw['id'] as String?;
                      if (id == null) {
                        return;
                      }
                      await ref.read(apiClientProvider).deletePlaylist(id);
                      ref.invalidate(libraryProvider);
                    },
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class PlaylistDetailScreen extends ConsumerStatefulWidget {
  const PlaylistDetailScreen({super.key, required this.playlistId});
  final String playlistId;

  @override
  ConsumerState<PlaylistDetailScreen> createState() =>
      _PlaylistDetailScreenState();
}

class _PlaylistDetailScreenState extends ConsumerState<PlaylistDetailScreen> {
  Map<String, dynamic>? data;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await ref
          .read(apiClientProvider)
          .playlist(widget.playlistId);
      if (mounted) {
        setState(() {
          data = result;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Playlist not found or still private.');
      }
    }
  }

  List<Map<String, dynamic>> get _tracks =>
      (data?['tracks'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .toList();

  Future<void> _rename() async {
    final controller = TextEditingController(
      text: data?['title'] as String? ?? '',
    );
    final title = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rename playlist'),
        content: TextField(controller: controller, autofocus: true),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (title == null || title.isEmpty) {
      return;
    }
    await ref
        .read(apiClientProvider)
        .updatePlaylist(widget.playlistId, title: title);
    ref.invalidate(libraryProvider);
    await _load();
  }

  Future<void> _deletePlaylist() async {
    await ref.read(apiClientProvider).deletePlaylist(widget.playlistId);
    ref.invalidate(libraryProvider);
    if (mounted) {
      context.go('/playlists');
    }
  }

  Future<void> _share() async {
    try {
      final result = await ref
          .read(apiClientProvider)
          .sharePlaylist(widget.playlistId);
      final path =
          result['path'] as String? ??
          '/playlists/shared/${result['token'] as String? ?? ''}';
      if (!mounted) {
        return;
      }
      final messenger = ScaffoldMessenger.of(context);
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Share playlist'),
          content: const Text(
            'This link shares track references only. Audio is never uploaded. Recipients stream from the original provider.',
          ),
          actions: [
            TextButton(
              onPressed: () async {
                await ref
                    .read(apiClientProvider)
                    .revokePlaylistShares(widget.playlistId);
                if (dialogContext.mounted) {
                  Navigator.pop(dialogContext);
                }
              },
              child: const Text('Stop sharing'),
            ),
            FilledButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: path));
                if (dialogContext.mounted) {
                  Navigator.pop(dialogContext);
                }
                messenger.showSnackBar(SnackBar(content: Text('Copied $path')));
              },
              child: const Text('Copy link'),
            ),
          ],
        ),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not create a share link.')),
        );
      }
    }
  }

  Future<void> _fork() async {
    try {
      final fork = await ref
          .read(apiClientProvider)
          .forkPlaylist(widget.playlistId);
      ref.invalidate(libraryProvider);
      final id = fork['id'] as String?;
      if (mounted && id != null) {
        context.push('/playlist/$id');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not fork this playlist.')),
        );
      }
    }
  }

  Future<void> _removeTrack(String trackId) async {
    await ref
        .read(apiClientProvider)
        .removePlaylistTrack(widget.playlistId, trackId);
    await _load();
  }

  Future<void> _onReorder(int oldIndex, int newIndex) async {
    final tracks = _tracks;
    if (newIndex > oldIndex) {
      newIndex -= 1;
    }
    final moved = tracks.removeAt(oldIndex);
    tracks.insert(newIndex, moved);
    setState(() {
      data = {...?data, 'tracks': tracks};
    });
    final ids = tracks.map(trackIdFromRow).whereType<String>().toList();
    try {
      final updated = await ref
          .read(apiClientProvider)
          .reorderPlaylistTracks(widget.playlistId, ids);
      if (mounted) {
        setState(() => data = updated);
      }
    } catch (_) {
      await _load();
    }
  }

  Future<void> _playAll() async {
    final api = ref.read(apiClientProvider);
    final downloads = ref.read(downloadStoreProvider);
    final disconnected = ref.read(offlineStoreProvider).offline;
    final items = <QueuedItem>[];
    for (final raw in _tracks) {
      final track = trackFromLibraryRow(raw);
      if (track == null) {
        continue;
      }
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
        appBar: AppBar(title: const Text('Playlist')),
        body: Center(child: Text(error!)),
      );
    }
    if (data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final tracks = _tracks;
    return Scaffold(
      appBar: AppBar(
        title: Text(data?['title'] as String? ?? 'Playlist'),
        actions: [
          IconButton(icon: const Icon(Icons.edit_outlined), onPressed: _rename),
          IconButton(icon: const Icon(Icons.ios_share), onPressed: _share),
          IconButton(
            icon: const Icon(Icons.flag_outlined),
            tooltip: 'Report',
            onPressed: () => showReportDialog(
              context,
              ref,
              entityType: 'playlist',
              entityId: widget.playlistId,
            ),
          ),
          IconButton(icon: const Icon(Icons.call_split), onPressed: _fork),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: _deletePlaylist,
          ),
        ],
      ),
      body: tracks.isEmpty
          ? const EmptyState(
              title: 'Empty playlist',
              message:
                  'Add tracks from a track page. This stores references only.',
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: FilledButton.icon(
                    onPressed: _playAll,
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Play all'),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    'Hold and drag to reorder. These are track references only.',
                  ),
                ),
                Expanded(
                  child: ReorderableListView.builder(
                    itemCount: tracks.length,
                    onReorder: _onReorder,
                    itemBuilder: (context, index) {
                      final raw = tracks[index];
                      final track = trackFromLibraryRow(raw);
                      final id = trackIdFromRow(raw) ?? '$index';
                      return ListTile(
                        key: ValueKey(id),
                        title: Text(track?.title ?? 'Track'),
                        subtitle: Text(track?.artistName ?? ''),
                        onTap: track == null
                            ? null
                            : () => context.push('/track/${track.id}'),
                        trailing: IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () {
                            final trackId = trackIdFromRow(raw);
                            if (trackId != null) {
                              _removeTrack(trackId);
                            }
                          },
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

class SharedPlaylistScreen extends ConsumerStatefulWidget {
  const SharedPlaylistScreen({super.key, required this.token});
  final String token;

  @override
  ConsumerState<SharedPlaylistScreen> createState() =>
      _SharedPlaylistScreenState();
}

class _SharedPlaylistScreenState extends ConsumerState<SharedPlaylistScreen> {
  Map<String, dynamic>? data;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await ref
          .read(apiClientProvider)
          .sharedPlaylist(widget.token);
      if (mounted) {
        setState(() => data = result);
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Share not found or it was revoked.');
      }
    }
  }

  Future<void> _fork() async {
    try {
      final fork = await ref
          .read(apiClientProvider)
          .forkSharedPlaylist(widget.token);
      ref.invalidate(libraryProvider);
      final id = fork['id'] as String?;
      if (mounted && id != null) {
        context.go('/playlist/$id');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in to fork this playlist.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Shared playlist')),
        body: Center(child: Text(error!)),
      );
    }
    if (data == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    final tracks = (data?['tracks'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final loggedIn = ref.watch(sessionStoreProvider).loggedIn;
    return Scaffold(
      appBar: AppBar(
        title: Text(data?['title'] as String? ?? 'Shared playlist'),
      ),
      body: ListView(
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Metadata only — audio is never uploaded. Recipients resolve each track from the original provider.',
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FilledButton.icon(
              onPressed: loggedIn ? _fork : () => context.push('/login'),
              icon: const Icon(Icons.call_split),
              label: Text(loggedIn ? 'Fork to my library' : 'Sign in to fork'),
            ),
          ),
          if (tracks.isEmpty)
            const EmptyState(
              title: 'Empty playlist',
              message: 'This share has no track references.',
            )
          else
            for (final raw in tracks)
              Builder(
                builder: (context) {
                  final track = trackFromLibraryRow(raw);
                  if (track == null) {
                    return const SizedBox.shrink();
                  }
                  return TrackTile(track: track);
                },
              ),
        ],
      ),
    );
  }
}

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final library = ref.watch(libraryProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: library.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, stack) => const EmptyState(
          title: 'Sign in required',
          message: 'Favorites live on your account.',
        ),
        data: (data) {
          final favorites = data['favorites'] as List<dynamic>? ?? [];
          if (favorites.isEmpty) {
            return const EmptyState(
              title: 'No favorites',
              message: 'Heart a track to save a metadata reference.',
            );
          }
          return ListView(
            children: [
              for (final raw in favorites.whereType<Map<String, dynamic>>())
                Builder(
                  builder: (context) {
                    final track = trackFromLibraryRow(raw);
                    if (track == null) {
                      return const SizedBox.shrink();
                    }
                    return Dismissible(
                      key: ValueKey(track.id),
                      direction: DismissDirection.endToStart,
                      onDismissed: (_) async {
                        await ref
                            .read(apiClientProvider)
                            .setFavorite(track.id, favorite: false);
                        ref.invalidate(libraryProvider);
                      },
                      child: TrackTile(track: track),
                    );
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}
