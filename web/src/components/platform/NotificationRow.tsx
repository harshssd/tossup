import Link from 'next/link'
import { timeAgo } from '@/lib/platform/pavilion'
import { NOTIFICATION_META, type AppNotification } from '@/lib/platform/notifications'

/** One notification line — shared by the header bell and the /notifications inbox
 *  so their rendering can't drift. Wraps in a Link when the notification has a
 *  target, else a button; `onSelect` fires on activation (mark-read + close). */
export function NotificationRow({ n, onSelect }: { n: AppNotification; onSelect: (n: AppNotification) => void }) {
  const meta = NOTIFICATION_META[n.kind]
  const body = (
    <div className={`flex items-start gap-2.5 px-4 py-3 ${n.read_at ? '' : 'bg-[#f6faf7]'}`}>
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: n.read_at ? '#d8d4c8' : meta.dot }} aria-hidden />
      <div className="min-w-0 flex-1">
        {!n.read_at && <span className="sr-only">Unread. </span>}
        <p className={`text-sm ${n.read_at ? 'text-[#3a382f]' : 'font-semibold text-[#16150f]'}`}>{n.title}</p>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#6f6c63]">{n.body}</p>}
        <p className="mt-0.5 text-[11px] text-[#9a978d]">{timeAgo(n.created_at)}</p>
      </div>
    </div>
  )
  return n.link ? (
    <Link href={n.link} onClick={() => onSelect(n)} className="block hover:bg-[#faf9f6]">
      {body}
    </Link>
  ) : (
    <button type="button" onClick={() => onSelect(n)} className="block w-full text-left hover:bg-[#faf9f6]">
      {body}
    </button>
  )
}
