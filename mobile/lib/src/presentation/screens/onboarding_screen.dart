import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/onboarding_controller.dart';
import '../../application/player_controller.dart';
import '../../application/providers.dart';
import '../../data/download_store.dart';
import '../theme/tokens.dart';
import '../widgets/onboarding_widgets.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key, this.settingsMode = false});

  final bool settingsMode;

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final controller = ref.read(onboardingControllerProvider);
      await controller.loadCatalogs();
      if (widget.settingsMode) {
        await controller.loadExisting();
        controller.go(OnboardingStep.artists);
      }
    });
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = ref.watch(onboardingControllerProvider);
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: OnboardingProgress(index: controller.preferenceIndex),
        leading: controller.step == OnboardingStep.welcome
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: controller.back,
              ),
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 280),
        child: KeyedSubtree(
          key: ValueKey(controller.step),
          child: _body(controller),
        ),
      ),
    );
  }

  Widget _body(OnboardingController controller) {
    switch (controller.step) {
      case OnboardingStep.welcome:
        return _Welcome(controller: controller);
      case OnboardingStep.artists:
        return _Artists(controller: controller, search: _search);
      case OnboardingStep.categories:
        return _Categories(controller: controller);
      case OnboardingStep.languages:
        return _Languages(controller: controller);
      case OnboardingStep.moods:
        return _Moods(controller: controller);
      case OnboardingStep.summary:
        return _Summary(controller: controller);
      case OnboardingStep.generating:
        return _Generating(controller: controller);
      case OnboardingStep.firstTen:
        return _FirstTen(controller: controller);
      case OnboardingStep.confirm:
        return _Confirm(controller: controller);
    }
  }
}

class _Welcome extends StatelessWidget {
  const _Welcome({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Container(
                  height: 180,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(28),
                    gradient: const LinearGradient(
                      colors: [OpenTuneTokens.teal, OpenTuneTokens.violet],
                    ),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.graphic_eq,
                      size: 88,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  "Let's make music yours.",
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 12),
                Text(
                  "Tell us what you love and we'll build your first listening experience from open licensed catalogs.",
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const Spacer(),
              ],
            ),
          ),
        ),
        OnboardingBottomAction(
          label: "Let's personalize",
          onPressed: () async {
            await controller.loadCatalogs();
            controller.go(OnboardingStep.artists);
          },
          secondary: () async {
            await controller.skip();
            if (context.mounted && GoRouter.maybeOf(context) != null) {
              context.go('/home');
            }
          },
          secondaryLabel: 'Skip for now',
        ),
      ],
    );
  }
}

class _Artists extends StatelessWidget {
  const _Artists({required this.controller, required this.search});
  final OnboardingController controller;
  final TextEditingController search;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Who do you love listening to?',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                const Text(
                  "Pick at least 3 artists from open catalogs. We'll use them to personalize your music.",
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: search,
                  decoration: InputDecoration(
                    hintText: 'Search artists',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.search),
                      onPressed: () => controller.searchArtists(search.text),
                    ),
                  ),
                  onSubmitted: controller.searchArtists,
                ),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: controller.clearArtists,
                    child: Text(
                      '${controller.selectedArtistIds.length} selected · Clear all',
                    ),
                  ),
                ),
                if (controller.error != null)
                  Text(
                    controller.error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                Expanded(
                  child: GridView.builder(
                    itemCount: controller.artists.length,
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.86,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                    itemBuilder: (context, index) {
                      final artist = controller.artists[index];
                      return ArtistSelectionCard(
                        artist: artist,
                        selected: controller.selectedArtistIds.contains(
                          artist.id,
                        ),
                        onTap: () => controller.toggleArtist(artist.id),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        OnboardingBottomAction(
          label: 'Continue',
          enabled: controller.canContinueArtists(),
          onPressed: () => controller.go(OnboardingStep.categories),
        ),
      ],
    );
  }
}

class _Categories extends StatelessWidget {
  const _Categories({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'What kind of music are you into?',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text('${controller.selectedCategorySlugs.length} selected'),
              const SizedBox(height: 16),
              for (var i = 0; i < controller.categories.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: CategorySelectionTile(
                    label: controller.categories[i]['name'] as String? ?? '',
                    selected: controller.selectedCategorySlugs.contains(
                      controller.categories[i]['slug'],
                    ),
                    wide: i == 0,
                    onTap: () => controller.toggleSlug(
                      controller.selectedCategorySlugs,
                      controller.categories[i]['slug'] as String,
                    ),
                  ),
                ),
              TextButton(
                onPressed: controller.revealMoreCategories,
                child: const Text('More'),
              ),
            ],
          ),
        ),
        OnboardingBottomAction(
          label: 'Continue',
          enabled: controller.canContinueCategories(),
          onPressed: () => controller.go(OnboardingStep.languages),
        ),
      ],
    );
  }
}

class _Languages extends StatelessWidget {
  const _Languages({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'Which languages should we play?',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              const Text('Choose the languages you would like to hear.'),
              const SizedBox(height: 8),
              const Text('Preferred languages'),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final row in controller.languages)
                    LanguageChip(
                      label: row['name'] as String? ?? '',
                      selected: controller.selectedLanguageCodes.contains(
                        row['code'],
                      ),
                      onTap: () => controller.toggleSlug(
                        controller.selectedLanguageCodes,
                        row['code'] as String,
                      ),
                    ),
                ],
              ),
              SwitchListTile(
                title: const Text('Prefer my selected languages'),
                value: controller.languageMode == 'prefer',
                onChanged: (value) {
                  controller.setLanguageMode(value ? 'prefer' : 'only');
                },
              ),
              SwitchListTile(
                title: const Text('Only show selected languages'),
                value: controller.languageMode == 'only',
                onChanged: (value) {
                  controller.setLanguageMode(value ? 'only' : 'prefer');
                },
              ),
            ],
          ),
        ),
        OnboardingBottomAction(
          label: 'Continue',
          enabled: controller.canContinueLanguages(),
          onPressed: () => controller.go(OnboardingStep.moods),
        ),
      ],
    );
  }
}

class _Moods extends StatelessWidget {
  const _Moods({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                "What's your vibe?",
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              const Text('Optional — skip if you prefer.'),
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final row in controller.moods)
                    MoodCard(
                      label: row['name'] as String? ?? '',
                      selected: controller.selectedMoodSlugs.contains(
                        row['slug'],
                      ),
                      onTap: () => controller.toggleSlug(
                        controller.selectedMoodSlugs,
                        row['slug'] as String,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        OnboardingBottomAction(
          label: 'Continue',
          onPressed: () => controller.go(OnboardingStep.summary),
          secondary: () => controller.go(OnboardingStep.summary),
          secondaryLabel: 'Skip vibe',
        ),
      ],
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'Your music profile',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 20),
              PreferenceSummary(
                artists: controller.selectedArtists.map((a) => a.name).toList(),
                genres: controller.selectedCategories
                    .map((row) => row['name'] as String? ?? '')
                    .toList(),
                languages: controller.selectedLanguages
                    .map((row) => row['name'] as String? ?? '')
                    .toList(),
                vibes: controller.selectedMoods
                    .map((row) => row['name'] as String? ?? '')
                    .toList(),
              ),
              if (controller.error != null)
                Text(
                  controller.error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
            ],
          ),
        ),
        OnboardingBottomAction(
          label: 'Build my music',
          onPressed: controller.busy ? null : controller.buildPack,
          secondary: () => controller.go(OnboardingStep.artists),
          secondaryLabel: 'Edit preferences',
        ),
      ],
    );
  }
}

class _Generating extends StatelessWidget {
  const _Generating({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              height: 88,
              width: 88,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
            const SizedBox(height: 24),
            Text(
              controller.generatingMessage,
              style: Theme.of(context).textTheme.headlineSmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _FirstTen extends StatelessWidget {
  const _FirstTen({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
                child: Text(
                  'Your first ${controller.starterTracks.length}',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 12),
                child: Text(controller.honestLabel),
              ),
              for (var i = 0; i < controller.starterTracks.length; i++)
                StarterTrackCard(
                  index: i + 1,
                  track: controller.starterTracks[i],
                  selected: controller.selectedStarterIds.contains(
                    controller.starterTracks[i].id,
                  ),
                  onToggle: () =>
                      controller.toggleStarter(controller.starterTracks[i].id),
                ),
            ],
          ),
        ),
        OnboardingBottomAction(
          label: 'Continue',
          onPressed: () => controller.go(OnboardingStep.confirm),
          secondary: controller.buildPack,
          secondaryLabel: 'Try again',
        ),
      ],
    );
  }
}

class _Confirm extends ConsumerWidget {
  const _Confirm({required this.controller});
  final OnboardingController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chosen = controller.downloadableStarter
        .where((track) => controller.selectedStarterIds.contains(track.id))
        .toList();
    final mb = (controller.estimatedBytes / 1e6)
        .clamp(0, 999)
        .toStringAsFixed(0);
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'Your offline starter pack',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                '${chosen.length} song${chosen.length == 1 ? '' : 's'}\n'
                '~$mb MB estimated\n\n'
                'These tracks can be downloaded to your device from the original provider. '
                'OpenTune never proxies audio.',
              ),
              const SizedBox(height: 16),
              const Text(
                'Downloading over mobile data may use your data plan.',
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Download on Wi-Fi only'),
                value: controller.wifiOnly,
                onChanged: controller.setWifiOnly,
              ),
            ],
          ),
        ),
        OnboardingBottomAction(
          label: chosen.isEmpty
              ? 'Start listening'
              : 'Download ${chosen.length} ${chosen.length == 1 ? 'track' : 'tracks'}',
          onPressed: controller.busy
              ? null
              : () async {
                  await controller.confirmAndGoHome();
                  ref.invalidate(homeProvider);
                  if (context.mounted && GoRouter.maybeOf(context) != null) {
                    context.go('/home');
                  }
                },
          secondary: () => controller.go(OnboardingStep.firstTen),
          secondaryLabel: 'Choose songs',
        ),
      ],
    );
  }
}

class StarterPackBanner extends ConsumerWidget {
  const StarterPackBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final downloads = ref.watch(downloadStoreProvider);
    if (downloads.packTrackIds.isEmpty) {
      return const SizedBox.shrink();
    }
    return DownloadProgressCard(
      completed: downloads.packCompletedCount,
      total: downloads.packTrackIds.length,
      progress: downloads.packProgress,
      currentTitle: downloads.packCurrentTitle,
      onPlay: () {
        final ready = downloads.libraryTracks();
        if (ready.isEmpty) {
          return;
        }
        ref
            .read(playerControllerProvider)
            .playTrack(
              track: ready.first,
              url: downloads.completed(ready.first.id)?.path ?? '',
            );
      },
    );
  }
}
