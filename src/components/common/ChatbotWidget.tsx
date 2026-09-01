import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, ChevronDown, RotateCcw } from 'lucide-react';
import { processChatQuery } from '../../services/chatbotLogic';
import { useInvoiceStore } from '../../stores/invoiceStore';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { text: "Hello! I am your Octopus Assistant.", role: 'model' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Smart Query Builder State
  const [showBuilder, setShowBuilder] = useState(false);
  const [qType, setQType] = useState('summary');
  const [qDate, setQDate] = useState('');
  const [qLob, setQLob] = useState('Total');
  const [qInterval, setQInterval] = useState('12:00');

  const { sortedDates, globalProcessedData, currentShiftMode } = useInvoiceStore();
  
  // Initialize default date
  useEffect(() => {
     if (sortedDates.length > 0 && !qDate) {
         setQDate(sortedDates[0]);
     }
  }, [sortedDates, qDate]);

  const availableLobs = useMemo(() => {
     if (!qDate || !globalProcessedData[qDate]?.[currentShiftMode]) return ['Total'];
     return Object.keys(globalProcessedData[qDate][currentShiftMode]);
  }, [qDate, globalProcessedData, currentShiftMode]);

  // Generate 30 min intervals
  const intervals = useMemo(() => {
      const ints = [];
      for(let h = 0; h < 24; h++) {
          const hh = h.toString().padStart(2, '0');
          ints.push(`${hh}:00`);
          ints.push(`${hh}:30`);
      }
      return ints;
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const newMessages = [...messages, { role: 'user' as const, text: textToSend }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Simulate thinking delay for local AI
    setTimeout(() => {
      try {
        const botResponse = processChatQuery(newMessages);
        setMessages(prev => [...prev, { text: botResponse, role: 'model' }]);
      } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { text: "Sorry, I encountered an error processing that request locally.", role: 'model' }]);
      } finally {
        setIsLoading(false);
      }
    }, 600);
  };

  const handleSmartAsk = () => {
      let query = "";
      if (qType === 'summary') query = `summarize ${qDate} for ${qLob}`;
      if (qType === 'abs') query = `tell me abs in ${qLob} on ${qDate}`;
      if (qType === 'ic') query = `tell me ic in ${qLob} on ${qDate}`;
      if (qType === 'headcount') query = `tell me headcount in ${qLob} on ${qDate}`;
      if (qType === 'interval_analysis') query = `why were we down at ${qInterval} in ${qLob} on ${qDate}?`;
      if (qType === 'intervals_down') query = `how many intervals down on ${qDate} in ${qLob}`;
      
      handleSend(query);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-[72px] right-6 w-11 h-11 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-50"
        >
          <MessageSquare size={18} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-[72px] right-6 w-[320px] sm:w-[350px] h-[480px] max-h-[75vh] bg-surface-0 border border-surface-200 rounded-xl shadow-lg flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="bg-brand-600 px-4 py-3 flex items-center justify-between text-white relative">
            <div className="flex items-center gap-2">
              <Bot size={20} />
              <div>
                <h3 className="font-semibold text-sm leading-tight">Octopus Assistant</h3>
                <p className="text-[10px] text-brand-200 font-medium tracking-wide">Local AI Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMessages([{ text: "Hello! I am your Octopus Assistant.", role: 'model' }])} className="text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/10" title="Start New Conversation">
                <RotateCcw size={16} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/10" title="Close Chat">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface-50 dark:bg-surface-0/50 relative">
            {messages.map((msg, idx) => {
              const isBot = msg.role === 'model';
              return (
              <div
                key={idx}
                className={`flex gap-3 max-w-[85%] ${isBot ? 'self-start' : 'self-end flex-row-reverse ml-auto'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isBot ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400' : 'bg-surface-200 text-surface-600 dark:bg-surface-800 dark:text-surface-300'}`}>
                  {isBot ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    isBot
                      ? 'bg-surface-0 border border-surface-200 text-surface-700 dark:bg-surface-50 dark:border-surface-100 dark:text-surface-300 rounded-tl-sm'
                      : 'bg-brand-600 text-white rounded-tr-sm'
                  }`}
                  dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }}
                />
              </div>
              );
            })}
            
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] self-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
                  <Bot size={16} />
                </div>
                <div className="px-4 py-2.5 rounded-2xl text-[13px] bg-surface-0 border border-surface-200 text-surface-500 rounded-tl-sm flex items-center gap-2">
                   <Loader2 size={14} className="animate-spin" /> Thinking...
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Smart Query Builder */}
          <div className="border-t border-surface-200 dark:border-surface-100 bg-surface-50 dark:bg-surface-0 flex flex-col">
            <button 
                onClick={() => setShowBuilder(!showBuilder)}
                className="flex items-center justify-between w-full px-4 py-2 text-xs font-semibold text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-50/50 transition-colors"
            >
                <span className="flex items-center gap-1.5">Smart Options</span>
                <ChevronDown size={14} className={`transform transition-transform ${showBuilder ? '' : 'rotate-180'}`} />
            </button>
            
            {showBuilder && (
                <div className="p-3 space-y-2 bg-surface-0 border-b border-surface-100">
                    <div className="grid grid-cols-2 gap-2">
                        <select 
                            value={qType} 
                            onChange={e => setQType(e.target.value)}
                            className="col-span-2 p-1.5 text-xs bg-surface-50 border border-surface-200 rounded-md focus:outline-none focus:border-brand-500"
                        >
                            <option value="summary">Summarize Day</option>
                            <option value="abs">Check Absenteeism</option>
                            <option value="ic">Check Interval Compliance</option>
                            <option value="headcount">Check Scheduled Headcount</option>
                            <option value="interval_analysis">Analyze Specific Interval</option>
                            <option value="intervals_down">Count Shortage Intervals</option>
                        </select>
                        
                        <select 
                            value={qDate} 
                            onChange={e => setQDate(e.target.value)}
                            className="p-1.5 text-xs bg-surface-50 border border-surface-200 rounded-md focus:outline-none focus:border-brand-500"
                        >
                            {sortedDates.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <select 
                            value={qLob} 
                            onChange={e => setQLob(e.target.value)}
                            className="p-1.5 text-xs bg-surface-50 border border-surface-200 rounded-md focus:outline-none focus:border-brand-500"
                        >
                            {availableLobs.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>

                        {qType === 'interval_analysis' && (
                           <select 
                               value={qInterval} 
                               onChange={e => setQInterval(e.target.value)}
                               className="col-span-2 p-1.5 text-xs bg-surface-50 border border-surface-200 rounded-md focus:outline-none focus:border-brand-500"
                           >
                               {intervals.map(i => <option key={i} value={i}>{i}</option>)}
                           </select>
                        )}
                    </div>
                    <button 
                        onClick={handleSmartAsk}
                        className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5"
                    >
                        Ask <Send size={12}/>
                    </button>
                </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 bg-surface-0 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Or type your question here..."
              className="flex-1 h-9 px-3 bg-surface-50 border border-surface-200 dark:border-surface-100 rounded-lg text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all text-surface-900"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 flex items-center justify-center bg-brand-600 hover:bg-brand-700 disabled:bg-surface-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Send size={16} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
