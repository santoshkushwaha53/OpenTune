import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/api_client.dart';

Future<void> showReportDialog(
  BuildContext context,
  WidgetRef ref, {
  required String entityType,
  required String entityId,
}) async {
  final reason = await showDialog<String>(
    context: context,
    builder: (context) => const _ReportDialog(),
  );
  if (reason == null || !context.mounted) {
    return;
  }
  if (reason.length < 8) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Please describe the issue (8+ characters).'),
      ),
    );
    return;
  }
  try {
    await ref
        .read(apiClientProvider)
        .report(entityType: entityType, entityId: entityId, reason: reason);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report submitted. Thank you.')),
      );
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not submit the report.')),
      );
    }
  }
}

class _ReportDialog extends StatefulWidget {
  const _ReportDialog();

  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Report'),
      content: TextField(
        controller: _controller,
        maxLines: 4,
        autofocus: true,
        decoration: const InputDecoration(
          labelText: 'What is wrong?',
          hintText: 'License, attribution, or abuse — metadata only',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, _controller.text.trim()),
          child: const Text('Submit'),
        ),
      ],
    );
  }
}
