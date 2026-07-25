// lib/screens/calendar_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/task_provider.dart';
import '../theme/app_theme.dart';
import '../utils/helpers.dart';
import '../widgets/task_card.dart';
import 'task_detail_screen.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  late DateTime _visibleMonth;

  static const _monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  static const _dayHeaders = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _visibleMonth = DateTime(now.year, now.month);
  }

  void _goToMonth(DateTime target, {DateTime? selectDate}) {
    setState(() => _visibleMonth = DateTime(target.year, target.month));
    if (selectDate != null) {
      context.read<TaskProvider>().setSelectedDate(selectDate);
    }
  }

  void _prevMonth() {
    _goToMonth(DateTime(_visibleMonth.year, _visibleMonth.month - 1));
  }

  void _nextMonth() {
    _goToMonth(DateTime(_visibleMonth.year, _visibleMonth.month + 1));
  }

  List<DateTime> _buildGridDays() {
    final firstOfMonth = DateTime(_visibleMonth.year, _visibleMonth.month, 1);
    final daysInMonth =
        DateTime(_visibleMonth.year, _visibleMonth.month + 1, 0).day;
    final leadingBlanks = firstOfMonth.weekday % 7; // Sunday = 0

    final totalCells = ((leadingBlanks + daysInMonth) / 7).ceil() * 7;
    return List.generate(totalCells, (i) {
      final dayOffset = i - leadingBlanks;
      return firstOfMonth.add(Duration(days: dayOffset));
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<TaskProvider>();
    final selected = provider.selectedDate;
    final gridDays = _buildGridDays();
    final items = provider.allItemsForSelectedDate;

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        title: const Text('Kalender',
            style: TextStyle(fontWeight: FontWeight.w700)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 6),
            decoration: BoxDecoration(
              color: AppColors.glassCard,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.chevron_left_rounded,
                          color: AppColors.textSecondary),
                      onPressed: _prevMonth,
                      splashRadius: 22,
                    ),
                    Text(
                      '${_monthNames[_visibleMonth.month - 1]} ${_visibleMonth.year}',
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                        letterSpacing: 0.4,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.chevron_right_rounded,
                          color: AppColors.textSecondary),
                      onPressed: _nextMonth,
                      splashRadius: 22,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  children: _dayHeaders
                      .map((d) => Expanded(
                            child: Center(
                              child: Text(
                                d,
                                style: const TextStyle(
                                  color: AppColors.textHint,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ))
                      .toList(),
                ),
                const SizedBox(height: 4),
                GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: gridDays.length,
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 7,
                    mainAxisExtent: 44,
                  ),
                  itemBuilder: (_, i) {
                    final day = gridDays[i];
                    final inCurrentMonth = day.month == _visibleMonth.month;
                    final isSelected = DateHelper.isSameDay(day, selected);
                    final isToday = DateHelper.isSameDay(day, DateTime.now());
                    final hasItems = provider.hasTasks(day);

                    return GestureDetector(
                      onTap: () => _goToMonth(day, selectDate: day),
                      child: Container(
                        margin: const EdgeInsets.all(1.5),
                        decoration: BoxDecoration(
                          gradient: isSelected ? AppColors.primaryGradient : null,
                          borderRadius: BorderRadius.circular(10),
                          border: !isSelected && isToday
                              ? Border.all(color: AppColors.accent, width: 1.2)
                              : null,
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Text(
                              '${day.day}',
                              style: TextStyle(
                                color: isSelected
                                    ? Colors.white
                                    : inCurrentMonth
                                        ? (isToday
                                            ? AppColors.accent
                                            : AppColors.textPrimary)
                                        : AppColors.textHint.withOpacity(0.4),
                                fontSize: 15,
                                fontWeight:
                                    isSelected ? FontWeight.w700 : FontWeight.w500,
                              ),
                            ),
                            if (hasItems)
                              Positioned(
                                bottom: 3,
                                child: Container(
                                  width: 4,
                                  height: 4,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isSelected
                                        ? Colors.white
                                        : AppColors.accent,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
            DateHelper.formatDateFull(selected),
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.event_busy_rounded,
                        size: 48, color: AppColors.textHint.withOpacity(0.3)),
                    const SizedBox(height: 10),
                    const Text(
                      'Tidak ada tugas atau agenda di tanggal ini',
                      style: TextStyle(color: AppColors.textHint, fontSize: 13),
                    ),
                  ],
                ),
              ),
            )
          else
            ...items.map(
              (task) => TaskCard(
                task: task,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ChangeNotifierProvider.value(
                      value: provider,
                      child: TaskDetailScreen(task: task),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
