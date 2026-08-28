/**
 * Aussie Grid — Help & FAQ
 * File: src/components/Help.tsx
 * Version: v0.1.2.2
 * Updated: 28 Aug 2026 — volunteer monitoring copy; QLD $ until bill tariff.
 */
import { useState } from 'react';

export interface HelpProps {
  onBack?: () => void;
}

interface FAQItem {
  question: string;
  answer: string;
}

const PILOT_SUPPORT_EMAIL = "help@aussiegrid.au";

const faqData: FAQItem[] = [
  {
    question: "What is the Aussie Grid Mackay Pilot?",
    answer: "We're working with a small group of local Mackay households in a listen-first pilot: we read live solar and battery data, show Estimated figures on your dashboard, and leave decisions with you. The aim is to learn how homes can use solar and batteries more wisely for households and the local grid — without overclaiming control or guaranteed bill outcomes.",
  },
  {
    question: "Why is everything read-only / suggest-only by default?",
    answer: "We're listening first. We read data from your solar and battery system so the agent can learn patterns and suggest operating modes. Automatic inverter control is not claimed as live until a confirmed control path exists for your system. That keeps the pilot simple and honest while we gather real-world evidence.",
  },
  {
    question: "How long before reports are useful — and when can I opt in?",
    answer: "About 2–4 weeks of live readings is advised so reports and Estimated figures better reflect your home's real pattern — that's guidance for evidence quality, not a waiting period. Once your system is connected, you can save an optional agent control preference anytime. Preference does not turn on automatic inverter changes by itself.",
  },
  {
    question: "What data do you collect from my system?",
    answer: "We collect solar production (kW), battery state of charge (%), home consumption (kW), grid import/export (kW), and daily operating mode suggestions. We do not collect personal identifying information beyond your household ID and the email you use to connect your Sungrow account.",
  },
  {
    question: "Will you ever control my inverter without asking?",
    answer: "No. You stay in charge. Saving an agent control preference is optional and records that you're open to control later — it does not enable automatic inverter changes today. Automatic control is not live until a confirmed control path exists, and any future actuation would stay within clear safety limits. You can leave the pilot at any time.",
  },
  {
    question: "How do I connect my Sungrow system?",
    answer: "Go to the Connect Inverter page from the dashboard or top menu. Follow the iSolarCloud authorise steps for read-only monitoring. Once live readings arrive, your dashboard can show Live data instead of placeholders. Connection is required before you can save an agent control preference.",
  },
  {
    question: "I submitted my connection but it still says not connected — what now?",
    answer: "Our team may need to review and activate read-only access (often within 1–2 business days). You'll hear from us when readings are flowing. If it's been longer than 48 hours, reply to the confirmation email or use the contact details below. Connected status means usable data pull — not Accept or OAuth alone.",
  },
  {
    question: "Where can I see my daily savings or agent suggestions?",
    answer: "On the main Dashboard you'll see live readings (when available). Estimated savings are labelled as estimated / Ergon 12D for QLD households with a priced tariff. Volunteer homes outside QLD can connect for monitoring — dollar estimates stay QLD (Ergon/Energex) until we have your bill tariff. Mode suggestions appear when the agent has enough data. Figures are sample-based and not a retailer bill.",
  },
  {
    question: "Can I leave the pilot at any time?",
    answer: "Yes, absolutely. Just let us know via email and we'll remove your household from data collection and deactivate the connection. There are no lock-in periods or penalties.",
  },
  {
    question: "Who do I contact if I have a technical problem or question?",
    answer: `Email ${PILOT_SUPPORT_EMAIL} or reply to any email we've sent you. For urgent inverter or system issues, please contact Sungrow support directly first — we're here to help with the pilot experience specifically.`,
  },
];

export function Help({ onBack }: HelpProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-900"
              >
                ← Back to Dashboard
              </button>
            )}
            <div>
              <h1 className="text-2xl font-semibold text-emerald-400">Help &amp; FAQ</h1>
              <p className="text-sm text-slate-400">Mackay Pilot — Listen first · you decide</p>
            </div>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm leading-relaxed text-slate-300">
            This page answers common questions from households in the Aussie Grid Mackay Pilot.
            Default is listen-first: read live data, show Estimated figures, leave decisions with you.
            Optional agent control preference is available when your system is connected — you choose if/when.
            Volunteer homes outside QLD can connect for monitoring. Dollar estimates stay QLD (Ergon/Energex)
            until we have your bill tariff.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-emerald-400">Frequently Asked Questions</h2>
          
          <div className="space-y-3">
            {faqData.map((item, index) => (
              <div 
                key={index} 
                className="rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-800/60 transition-colors"
                  aria-expanded={openIndex === index}
                >
                  <span className="pr-4 text-sm font-medium text-slate-200">{item.question}</span>
                  <span className="text-emerald-400 text-xl leading-none">
                    {openIndex === index ? '−' : '+'}
                  </span>
                </button>
                
                {openIndex === index && (
                  <div className="px-5 pb-5 pt-1 text-sm leading-relaxed text-slate-300 border-t border-slate-700">
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Still have questions? */}
        <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/10 p-5 mb-8">
          <h3 className="text-base font-semibold text-emerald-400">Still have questions?</h3>
          <p className="mt-2 text-sm text-slate-300">
            We're a small local team and happy to help. The fastest way to reach us during the pilot is:
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p><span className="font-medium text-emerald-300">Email:</span> {PILOT_SUPPORT_EMAIL}</p>
            <p><span className="font-medium text-emerald-300">Reply</span> to any email we've already sent you</p>
          </div>
          <p className="mt-3 text-xs text-emerald-300/80">
            We usually respond within one business day. For urgent system or inverter faults, please contact Sungrow support directly.
          </p>
        </div>

        {/* Quick links / next steps */}
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
          <h3 className="text-base font-semibold text-emerald-400 mb-3">Quick actions</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>• <span className="font-medium">Connect your Sungrow system</span> — go to the Connect Inverter page from the top menu</li>
            <li>• <span className="font-medium">Check your daily suggestion</span> — return to the Dashboard to see today's mode and reasoning</li>
            <li>• <span className="font-medium">Agent control preference</span> — optional, anytime once connected (does not enable automatic control today)</li>
            <li>• <span className="font-medium">Switch between test households</span> — use the DEV dropdown in the top-right (visible in development)</li>
          </ul>
        </div>

        {/* Footer reassurance */}
        <div className="mt-8 text-center text-xs text-slate-500">
          Aussie Grid Mackay Pilot • Listen first • Preference ≠ automatic control • You stay in charge
        </div>
      </div>
    </div>
  );
}

export default Help;
