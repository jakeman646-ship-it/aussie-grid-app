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
    answer: "We're working with a small group of local Mackay households to test whether a smart agent can help homes use solar and batteries more efficiently — both for the household and for the local grid. The goal is to reduce bills, support grid stability, and keep more solar energy in the community.",
  },
  {
    question: "Why is everything read-only right now?",
    answer: "We're in the pre-pilot learning phase. During this stage we only read data from your solar and battery system so the agent can learn what works best for Mackay homes. We cannot control your inverter or change any settings yet. This keeps everything simple and safe while we gather real-world data.",
  },
  {
    question: "How long will the pre-pilot phase last?",
    answer: "It depends on how quickly we get good data from participating homes. Our target is to move into the active pilot phase (where the agent can start setting operating modes) within the next 4–8 weeks, once we've seen consistent patterns across the group.",
  },
  {
    question: "What data do you collect from my system?",
    answer: "We collect solar production (kW), battery state of charge (%), home consumption (kW), grid import/export (kW), and daily operating mode suggestions. We do not collect personal identifying information beyond your household ID and the email you use to connect your Sungrow account.",
  },
  {
    question: "Will you ever control my inverter without asking?",
    answer: "No. During the entire pilot you stay in full control. Even in the active phase, the agent will only suggest or set operating modes within clear safety limits that you approve during onboarding. You can always override or leave the pilot at any time.",
  },
  {
    question: "How do I connect my Sungrow system?",
    answer: "Go to the Connect Inverter page from the dashboard or top menu. You'll need your Sungrow Site ID (Plant ID) and the email linked to your iSolarCloud account. We request read-only API access on your behalf. Once approved, your dashboard will show 'Live data' instead of sample data.",
  },
  {
    question: "I submitted my Site ID but it still says not connected — what now?",
    answer: "Our team manually reviews and activates each connection (usually within 1–2 business days). You'll receive a confirmation email when it's live. If it's been longer than 48 hours, reply to the confirmation email or use the contact details below.",
  },
  {
    question: "Where can I see my daily savings or agent suggestions?",
    answer: "On the main Dashboard you'll see your current operating mode, the agent's reasoning, tomorrow's solar outlook, and estimated savings. Daily and weekly savings trends will be added in a future update once we have more real data.",
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
              <p className="text-sm text-slate-400">Mackay Pilot — Pre-pilot learning phase</p>
            </div>
          </div>
        </div>

        {/* Intro */}
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-sm leading-relaxed text-slate-300">
            This page answers the most common questions from households in the Aussie Grid Mackay Pilot. 
            We're still in the early data collection stage, so everything is read-only while we learn together.
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
            <li>• <span className="font-medium">Switch between test households</span> — use the DEV dropdown in the top-right (visible in development)</li>
          </ul>
        </div>

        {/* Footer reassurance */}
        <div className="mt-8 text-center text-xs text-slate-500">
          Aussie Grid Mackay Pilot • Pre-pilot learning phase • Read-only access only • Your system stays under your full control
        </div>
      </div>
    </div>
  );
}

export default Help;