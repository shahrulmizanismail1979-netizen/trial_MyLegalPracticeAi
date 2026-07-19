import { Task } from "@/lib/api-client";
import { TaskCard } from "@/components/TaskCard";

/**
 * Organic, masonry-style arrangement of task cards. Cards flow across columns
 * and keep their natural heights (CSS multi-column), giving a staggered board
 * feel rather than a rigid top-to-bottom list. Single column on small screens.
 */
export function TaskGrid({ tasks }: { tasks: Task[] }) {
  return (
    <div className="gap-6 [column-fill:_balance] columns-1 md:columns-2">
      {tasks.map((task, i) => (
        <div 
          key={task.id} 
          className="mb-6 break-inside-avoid animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
          style={{ animationDelay: `${i * 75}ms` }}
        >
          <TaskCard task={task} />
        </div>
      ))}
    </div>
  );
}
