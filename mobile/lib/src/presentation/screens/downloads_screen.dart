import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/player_controller.dart';
import '../../data/download_store.dart';
import '../../domain/track.dart';
import '../widgets/empty_state.dart';

class DownloadsScreen extends ConsumerWidget {
  const DownloadsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final store = ref.watch(downloadStoreProvider);
    final items = store.items.values.toList();
    if (items.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('Downloads')),
        body: const EmptyState(
          title: 'No offline files',
          message:
              'Only tracks with an explicit provider download URL can be saved on this device.',
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Downloads')),
      body: ListView(
        children: [
          if (store.packTrackIds.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(8),
              child: OverflowBar(
                children: [
                  TextButton(
                    onPressed: store.pausePack,
                    child: const Text('Pause all'),
                  ),
                  TextButton(
                    onPressed: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/home');
                      }
                    },
                    child: const Text('Continue in background'),
                  ),
                ],
              ),
            ),
          for (final item in items)
            ListTile(
              title: Text(item.title),
              subtitle: Text(_subtitle(item)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (item.state == DownloadState.downloading)
                    SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        value: item.progress <= 0 ? null : item.progress,
                      ),
                    )
                  else if (item.isCompleted)
                    const Icon(Icons.check)
                  else
                    const Icon(Icons.error_outline),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () => store.remove(item.trackId),
                  ),
                ],
              ),
              onTap: () async {
                if (!store.isOffline(item.trackId)) {
                  if (item.state == DownloadState.downloading) {
                    await store.cancel(item.trackId);
                  }
                  return;
                }
                await ref
                    .read(playerControllerProvider)
                    .playTrack(
                      track: TrackSummary(
                        id: item.trackId,
                        title: item.title,
                        durationMs: 0,
                        spdxId: item.license,
                      ),
                      url: 'https://example.invalid/offline',
                      license: item.license,
                      attribution: item.attribution,
                    );
                if (context.mounted) {
                  context.push('/player');
                }
              },
            ),
        ],
      ),
    );
  }
}

String _subtitle(DownloadRecord item) {
  if (item.state == DownloadState.downloading) {
    return 'Downloading from the provider…';
  }
  if (item.state == DownloadState.failed) {
    return item.error ?? 'Download failed';
  }
  final license = item.license ?? 'License on device';
  if (item.bytes == null) {
    return license;
  }
  return '$license · ${item.bytes} bytes on this device';
}
