"use client";

import { Flame, Plus } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DailyAdvice } from "@/components/advice/DailyAdvice";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { CompletedSection } from "@/components/home/CompletedSection";
import { PendingSection } from "@/components/home/PendingSection";
import { TaskSection } from "@/components/home/TaskSection";
import { PageHeader } from "@/components/layout/PageHeader";
import { TaskBoard, TaskRows, useTaskBoard } from "@/components/tasks/TaskBoard";
import type { Bilingual } from "@/lib/advice";
import { useT } from "@/lib/i18n/locale-context";
import {
  partitionTasks,
  sortByDateAndPriority,
  sortCompletedToday,
} from "@/lib/tasks";
import type { Category, Task } from "@/lib/types";

type HomeContentProps = {
  userName: string;
  hour: number;
  today: string;
  dayOfYear: number;
  /** All pending tasks; sections are derived client-side so moves are instant */
  tasks: Task[];
  completedToday: Task[];
  categories: Category[];
  bestStreak: number;
  /** Consejo de inicio del día, o null si todavía no hay ninguno generado. */
  advice: Bilingual | null;
};

export function HomeContent(props: HomeContentProps) {
  return (
    <TaskBoard
      categories={props.categories}
      today={props.today}
      initialTasks={props.tasks}
      initialCompletedToday={props.completedToday}
    >
      <HomeSections {...props} />
    </TaskBoard>
  );
}

function HomeSections({
  userName,
  hour,
  today,
  dayOfYear,
  categories,
  bestStreak,
  advice,
}: HomeContentProps) {
  const t = useT();
  const board = useTaskBoard();

  const greeting =
    hour < 12
      ? t.home.greetingMorning
      : hour < 19
        ? t.home.greetingAfternoon
        : t.home.greetingEvening;

  const { pending, upcoming } = partitionTasks(board.tasks, today);
  const completedToday = sortCompletedToday(board.completedToday);
  const done = completedToday.length;
  const success = completedToday.filter((task) => task.status === "yes").length;
  const failure = completedToday.filter((task) => task.status === "no").length;

  return (
    <div className="space-y-6" data-testid="home">
      <PageHeader
        title={`${greeting}${userName ? `, ${userName.split(" ")[0]}` : ""}`}
        subtitle={
          bestStreak > 0 && (
            <p className="mt-1 flex items-center gap-1 text-sm font-semibold">
              <Flame className="size-4 text-streak" />
              <span className="gradient-streak bg-clip-text text-transparent">
                {bestStreak} {t.home.streak}
              </span>
            </p>
          )
        }
        actions={
          <Button onClick={() => board.openNewTask()} data-testid="new-task">
            <Plus className="size-4" />
            {t.tasks.newTask}
          </Button>
        }
      />

      <DailyAdvice advice={advice} dayOfYear={dayOfYear} />

      <PendingSection
        pending={pending}
        completedToday={completedToday}
        success={success}
        failure={failure}
        done={done}
      />

      <TaskSection
        id="upcoming"
        title={t.home.upcoming}
        count={upcoming.length}
        emptyMessage={t.home.emptyUpcoming}
        defaultOpen={false}
      >
        <TaskRows tasks={upcoming} />
      </TaskSection>

      {categories.map((category) => {
        const categoryTasks = sortByDateAndPriority(
          board.tasks.filter((task) => task.category_id === category.id)
        );
        return (
          <TaskSection
            key={category.id}
            id={`cat-${category.id}`}
            title={
              <>
                <CategoryIcon
                  icon={category.icon}
                  color={category.color}
                  className="size-4 shrink-0"
                />
                <span className="truncate">
                  {category.is_default ? t.categories.general : category.name}
                </span>
              </>
            }
            accentColor={category.color}
            count={categoryTasks.length}
            emptyMessage={t.home.emptyList}
            defaultOpen={false}
          >
            <TaskRows tasks={categoryTasks} />
          </TaskSection>
        );
      })}

      <CompletedSection showCategory defaultOpen={false} />
    </div>
  );
}
