import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../domain/preferences.dart';
import '../../domain/track.dart';
import '../theme/tokens.dart';

class OnboardingProgress extends StatelessWidget {
  const OnboardingProgress({super.key, required this.index, this.total = 5});

  final int index;
  final int total;

  @override
  Widget build(BuildContext context) {
    if (index <= 0) {
      return const SizedBox.shrink();
    }
    return Text(
      '${index.toString().padLeft(2, '0')} / ${total.toString().padLeft(2, '0')}',
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        color: OpenTuneTokens.teal,
        letterSpacing: 1.4,
      ),
    );
  }
}

class OnboardingBottomAction extends StatelessWidget {
  const OnboardingBottomAction({
    super.key,
    required this.label,
    required this.onPressed,
    this.enabled = true,
    this.secondary,
    this.secondaryLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final VoidCallback? secondary;
  final String? secondaryLabel;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FilledButton(
              onPressed: enabled ? onPressed : null,
              child: Text(label),
            ),
            if (secondary != null && secondaryLabel != null)
              TextButton(onPressed: secondary, child: Text(secondaryLabel!)),
          ],
        ),
      ),
    );
  }
}

class ArtistSelectionCard extends StatelessWidget {
  const ArtistSelectionCard({
    super.key,
    required this.artist,
    required this.selected,
    required this.onTap,
  });

  final CatalogArtist artist;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: selected ? 1.02 : 1,
      duration: const Duration(milliseconds: 180),
      child: Material(
        color: selected
            ? OpenTuneTokens.teal.withValues(alpha: 0.16)
            : OpenTuneTokens.surfaceHigh,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: BorderSide(
            color: selected ? OpenTuneTokens.teal : Colors.transparent,
            width: 2,
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              children: [
                Expanded(
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: artist.artworkUrl == null
                            ? const ColoredBox(
                                color: OpenTuneTokens.surface,
                                child: Icon(Icons.person, size: 42),
                              )
                            : CachedNetworkImage(
                                imageUrl: artist.artworkUrl!,
                                fit: BoxFit.cover,
                              ),
                      ),
                      if (selected)
                        const Align(
                          alignment: Alignment.topRight,
                          child: Padding(
                            padding: EdgeInsets.all(6),
                            child: Icon(
                              Icons.check_circle,
                              color: OpenTuneTokens.teal,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  artist.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CategorySelectionTile extends StatelessWidget {
  const CategorySelectionTile({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.wide = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        gradient: LinearGradient(
          colors: selected
              ? [
                  OpenTuneTokens.teal.withValues(alpha: 0.55),
                  OpenTuneTokens.violet,
                ]
              : [OpenTuneTokens.surfaceHigh, OpenTuneTokens.surface],
        ),
        border: Border.all(
          color: selected ? OpenTuneTokens.teal : Colors.white12,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: 16,
            vertical: wide ? 28 : 20,
          ),
          child: Row(
            children: [
              if (selected) const Icon(Icons.check, color: Colors.white),
              if (selected) const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class LanguageChip extends StatelessWidget {
  const LanguageChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      selected: selected,
      label: Text(label),
      onSelected: (_) => onTap(),
      selectedColor: OpenTuneTokens.teal.withValues(alpha: 0.28),
    );
  }
}

class MoodCard extends StatelessWidget {
  const MoodCard({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      selected: selected,
      label: Text(label),
      onSelected: (_) => onTap(),
      selectedColor: OpenTuneTokens.violet.withValues(alpha: 0.4),
    );
  }
}

class PreferenceSummary extends StatelessWidget {
  const PreferenceSummary({
    super.key,
    required this.artists,
    required this.genres,
    required this.languages,
    required this.vibes,
  });

  final List<String> artists;
  final List<String> genres;
  final List<String> languages;
  final List<String> vibes;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _block(context, 'Artists', artists),
        _block(context, 'Genres', genres),
        _block(context, 'Languages', languages),
        if (vibes.isNotEmpty) _block(context, 'Vibes', vibes),
      ],
    );
  }

  Widget _block(BuildContext context, String title, List<String> values) {
    if (values.isEmpty) {
      return const SizedBox.shrink();
    }
    final shown = values.take(3).join('\n');
    final extra = values.length > 3 ? '\n+${values.length - 3} more' : '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 6),
          Text('$shown$extra', style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class StarterTrackCard extends StatelessWidget {
  const StarterTrackCard({
    super.key,
    required this.index,
    required this.track,
    required this.selected,
    required this.onToggle,
  });

  final int index;
  final TrackSummary track;
  final bool selected;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final minutes = track.durationMs ~/ 60000;
    final seconds = ((track.durationMs % 60000) / 1000)
        .round()
        .toString()
        .padLeft(2, '0');
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: OpenTuneTokens.surfaceHigh,
        child: Text(index.toString().padLeft(2, '0')),
      ),
      title: Text(track.title),
      subtitle: Text(
        '${track.artistName ?? 'Unknown artist'}\n'
        '$minutes:$seconds'
        '${track.spdxId != null ? ' · ${track.spdxId}' : ''}\n'
        '${track.download ? '✓ Included in offline starter pack' : 'Streaming only'}',
      ),
      isThreeLine: true,
      trailing: track.download
          ? Checkbox(value: selected, onChanged: (_) => onToggle())
          : null,
    );
  }
}

class DownloadProgressCard extends StatelessWidget {
  const DownloadProgressCard({
    super.key,
    required this.completed,
    required this.total,
    required this.progress,
    this.currentTitle,
    this.onPlay,
  });

  final int completed;
  final int total;
  final double progress;
  final String? currentTitle;
  final VoidCallback? onPlay;

  @override
  Widget build(BuildContext context) {
    if (total <= 0) {
      return const SizedBox.shrink();
    }
    return Card(
      color: OpenTuneTokens.surfaceHigh,
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              completed >= total ? 'Ready to play' : 'Saving your mix',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text('$completed of $total'),
            const SizedBox(height: 8),
            LinearProgressIndicator(value: progress.clamp(0, 1)),
            if (currentTitle != null) ...[
              const SizedBox(height: 8),
              Text(currentTitle!, maxLines: 1, overflow: TextOverflow.ellipsis),
            ],
            if (completed > 0 && onPlay != null)
              TextButton(onPressed: onPlay, child: const Text('Play now')),
          ],
        ),
      ),
    );
  }
}
