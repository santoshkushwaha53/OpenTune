import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/providers.dart';
import '../../data/offline_store.dart';
import '../widgets/empty_state.dart';
import '../widgets/offline_banner.dart';

class CatalogSourcesScreen extends ConsumerWidget {
  const CatalogSourcesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final disconnected = ref.watch(offlineStoreProvider).offline;
    final sources = ref.watch(catalogSourcesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Catalog sources')),
      body: sources.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => const EmptyState(
          title: 'Could not load sources',
          message:
              'Provider health is metadata only. Connect to see which catalogs are enabled.',
          icon: Icons.cloud_off,
        ),
        data: (rows) {
          if (rows.isEmpty) {
            return ListView(
              children: [
                if (disconnected)
                  const OfflineBanner(
                    message:
                        'Offline — catalog source status needs a connection.',
                  ),
                const EmptyState(
                  title: 'No catalog sources',
                  message:
                      'OpenTune lists providers that supply metadata. Audio never comes from this API.',
                ),
              ],
            );
          }
          return ListView(
            children: [
              if (disconnected)
                const OfflineBanner(
                  message:
                      'Offline — showing last fetched catalog source status.',
                ),
              const Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: Text(
                  'These connectors supply titles, licenses, and source IDs. '
                  'OpenTune never hosts or proxies audio.',
                ),
              ),
              for (final row in rows)
                ListTile(
                  leading: Icon(
                    (row['isEnabled'] as bool? ?? false)
                        ? Icons.check_circle_outline
                        : Icons.pause_circle_outline,
                  ),
                  title: Text(
                    row['name'] as String? ??
                        row['slug'] as String? ??
                        'Provider',
                  ),
                  subtitle: Text(_subtitle(row)),
                ),
            ],
          );
        },
      ),
    );
  }

  String _subtitle(Map<String, dynamic> row) {
    final slug = row['slug'] as String? ?? '';
    final health = row['healthStatus'] as String? ?? 'unknown';
    final enabled = row['isEnabled'] as bool? ?? false;
    final priority = row['priority'];
    final rank = priority is int ? 'P$priority · ' : '';
    return '$rank$slug · ${enabled ? 'enabled' : 'disabled'} · $health';
  }
}
