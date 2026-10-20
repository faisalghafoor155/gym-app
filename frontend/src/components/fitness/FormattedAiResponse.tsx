import { Sparkles } from 'lucide-react';

export default function FormattedAiResponse({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-gray-800 dark:text-slate-200">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;

        // Header 3 or 2
        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const text = trimmed.replace(/^#{2,3}\s+/, '');
          return (
            <h4 key={i} className="text-sm font-bold text-purple-900 dark:text-purple-300 pt-2 pb-0.5 border-b border-purple-100 dark:border-purple-900/30 flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span>{renderBold(text)}</span>
            </h4>
          );
        }

        // Horizontal divider
        if (trimmed === '---' || trimmed === '***') {
          return <hr key={i} className="border-gray-200 dark:border-slate-800 my-2" />;
        }

        // Bullet point
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const text = trimmed.substring(2);
          return (
            <div key={i} className="flex items-start gap-2 pl-1.5">
              <span className="text-purple-600 dark:text-purple-400 font-bold shrink-0 leading-5">•</span>
              <span className="leading-5">{renderBold(text)}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1.5">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 shrink-0 leading-5">
                {numMatch[1]}.
              </span>
              <span className="leading-5">{renderBold(numMatch[2])}</span>
            </div>
          );
        }

        // Callout tip or blockquote
        if (trimmed.startsWith('💡') || trimmed.startsWith('⚠️') || trimmed.startsWith('>')) {
          const text = trimmed.replace(/^>\s*/, '');
          return (
            <div key={i} className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 text-purple-950 dark:text-purple-200 font-medium my-1">
              {renderBold(text)}
            </div>
          );
        }

        return <p key={i} className="leading-5">{renderBold(trimmed)}</p>;
      })}
    </div>
  );
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-gray-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
