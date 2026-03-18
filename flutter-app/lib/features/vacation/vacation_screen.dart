import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class VacationScreen extends StatelessWidget {
  const VacationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: const Text('Амралт & Чөлөө')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.beach_access_outlined,
                size: 48, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text(
              'Амралтын хүсэлт',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              'Дараагийн шатанд хэрэгжинэ',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}
