import { useInvoiceStore } from '../stores/invoiceStore';

// Basic in-memory conversational context for the local engine
const conversationalContext = {
    lastLOB: null as string | null,
    lastDate: null as string | null,
    lastInterval: null as string | null,
};

export const processChatQuery = (
  messages: { role: 'user' | 'model'; text: string }[]
): string => {
  const q = messages[messages.length - 1].text.toLowerCase().trim();
  const historyText = messages.map(m => m.text.toLowerCase()).join(" ");

  const { sortedDates, globalProcessedData, currentShiftMode, agentInfo } = useInvoiceStore.getState();

  // ---------------------------------------------------------------------------
  // 1. GENERAL KNOWLEDGE HEURISTICS (Faking a general-purpose AI)
  // ---------------------------------------------------------------------------
  if (q.includes("explain react")) {
      return "React is a popular open-source JavaScript library developed by Facebook for building user interfaces. It uses a component-based architecture and a virtual DOM to efficiently update and render UI elements, making it ideal for single-page applications.";
  }
  if (q.includes("what is typescript")) {
      return "TypeScript is a strongly typed superset of JavaScript developed by Microsoft. It adds static types to the language, which helps catch errors at compile-time rather than runtime, making large codebases much easier to maintain and scale.";
  }
  if (q.includes("help me write an email")) {
      return "I'd be happy to help! Here's a professional template you can use:\n\n**Subject:** Update on [Project/Task Name]\n\nHi [Name],\n\nI hope this email finds you well. I wanted to provide a quick update on [Project]. We have successfully completed [Milestone] and are currently focusing on [Next Step].\n\nPlease let me know if you need any further information or would like to schedule a quick sync.\n\nBest regards,\n[Your Name]";
  }
  if (q.includes("translate this")) {
      return "As a local dashboard AI, my translation dictionary is currently limited, but I can certainly try! Please provide the sentence you'd like translated to English.";
  }
  if (q.includes("explain marketing")) {
      return "Marketing is the process of exploring, creating, and delivering value to meet the needs of a target market. It involves understanding consumer behavior, identifying opportunities, and developing strategies for product, pricing, placement, and promotion (the 4 Ps) to drive business growth.";
  }
  if (q.includes("http and https") || q.includes("difference between http")) {
      return "HTTP (Hypertext Transfer Protocol) is the standard protocol for transferring data across the web. HTTPS is the secure version of HTTP. The 'S' stands for 'Secure', meaning it uses SSL/TLS encryption to protect the data being transferred from interception or tampering.";
  }
  if (q.includes("idea for a project")) {
      return "How about building a real-time collaborative task board? You could use React for the frontend, Node.js with WebSockets for real-time updates, and a lightweight database to store tasks. It's a great way to learn state management and live data syncing!";
  }
  if (q.includes("what does this word mean") || q.includes("explain this concept simply")) {
      return "I can certainly explain concepts! However, as I'm currently running in local offline mode, my general knowledge base is limited to tech and RTM concepts. Please ask me about metrics like IC, Occupancy, or web concepts!";
  }
  if (q.includes("tell me a joke")) {
      return "Why do programmers prefer dark mode? Because light attracts bugs!";
  }
  if (q.includes("improve my english")) {
      return "To improve your English, try reading technical articles, watching videos with subtitles, and actively participating in text-based discussions. And of course, keep chatting with me—I'll always respond in proper English!";
  }

  // ---------------------------------------------------------------------------
  // 2. DASHBOARD CONCEPT EXPLANATIONS
  // ---------------------------------------------------------------------------
  if (q.includes("what is ic") || q.includes("explain ic")) {
      let response = "Interval Compliance (IC) measures how well we met the staffing requirements for a specific interval. It is calculated as (Actual Staff / Required Staff).";
      if (q.includes("why ours is low") || q.includes("why is it low")) {
          // Fall through to dashboard logic below to append specific data analysis
      } else {
          return response;
      }
  }
  if (q.includes("explain occupancy")) {
      return "Occupancy is the percentage of time agents are actively busy handling customer interactions (like calls or chats) compared to their total available time. High occupancy (>85%) means agents are very busy, which can lead to burnout. Low occupancy means agents have a lot of idle time waiting for work.";
  }

  // ---------------------------------------------------------------------------
  // 3. CONTEXT DETECTION & ENTITY EXTRACTION
  // ---------------------------------------------------------------------------
  
  // A. Detect Dates
  let detectedDate = sortedDates.find(d => q.includes(d.toLowerCase()));
  if (!detectedDate && conversationalContext.lastDate) {
      detectedDate = conversationalContext.lastDate; // Fallback to history
  }
  if (detectedDate) conversationalContext.lastDate = detectedDate;

  // ---------------------------------------------------------------------------
  // 4. DATA RETRIEVAL & REASONING
  // ---------------------------------------------------------------------------
  if (!detectedDate) {
      detectedDate = sortedDates[0];
      conversationalContext.lastDate = detectedDate;
  }

  const dayData = globalProcessedData[detectedDate]?.[currentShiftMode];
  if (!dayData) {
      return `I don't have dashboard data available for ${detectedDate}.`;
  }

  // B. Detect LOBs (Dynamically from dayData keys)
  const availableLobs = Object.keys(dayData).filter(k => k !== 'Total');
  let detectedLob = availableLobs.find(l => q.includes(l.toLowerCase().replace("-", "")));
  
  // Custom mappings for common slang
  if (q.includes("what about food") || q.includes("is it food")) detectedLob = "Food";
  if (q.includes("what about mart") || q.includes("is it mart")) detectedLob = "Mart";
  if (q.includes("t-pro") || q.includes("tpro")) detectedLob = availableLobs.find(l => l.toLowerCase().includes("tpro")) || "TPro";

  if (!detectedLob && conversationalContext.lastLOB) {
      detectedLob = conversationalContext.lastLOB; // Fallback to history
  } else if (!detectedLob) {
      detectedLob = "Total"; // Default to Total if no specific LOB is found
  }
  conversationalContext.lastLOB = detectedLob;
  const targetLobKey = detectedLob === "Combined" || detectedLob === "Total" ? "Total" : detectedLob;

  // C. Detect Intervals
  let detectedInterval: string | null = null;
  const timeRegex = /([0-1]?[0-9]|2[0-3]):[0-5][0-9]/;
  const match = q.match(timeRegex);
  if (match) {
      detectedInterval = match[0];
      if (detectedInterval.length === 4) detectedInterval = "0" + detectedInterval;
  }
  
  if (q.includes("previous interval") || q.includes("what changed")) {
      if (conversationalContext.lastInterval) {
          detectedInterval = "PREVIOUS_" + conversationalContext.lastInterval;
      }
  } else if (!detectedInterval && conversationalContext.lastInterval) {
      detectedInterval = conversationalContext.lastInterval;
  }
  
  if (detectedInterval && !detectedInterval.startsWith("PREVIOUS_")) {
      conversationalContext.lastInterval = detectedInterval;
  }

  // Hard questions tracking
  if (q.includes("how many intervals down on") || q.includes("intervals down")) {
      const t = dayData['Total'];
      if (!t) return `I don't have total data for ${detectedDate}.`;
      let downCount = 0;
      t.intervals.forEach((i: any) => {
         if (i.lost > 0) downCount++;
      });
      return `On **${detectedDate}**, there were **${downCount} intervals** that experienced a shortage (Actual < Required).`;
  }

  // Single Metric Query (e.g. "tell me abs in t-pro")
  const isAskingForAbs = q.includes(" abs ") || q.includes("absenteeism") || q.endsWith(" abs");
  const isAskingForIC = q.includes(" ic ") || q.endsWith(" ic") || q.includes("interval compliance");
  const isAskingForHeadcount = q.includes("headcount") || q.includes("scheduled");
  
  if (!detectedInterval && !q.includes("summary") && !q.includes("summarize") && !q.includes("why")) {
      const t = dayData[targetLobKey];
      if (!t) return `I don't have data for ${detectedLob} on ${detectedDate}.`;
      
      if (isAskingForAbs) {
          const absPerc = t.sch > 0 ? ((t.abs / t.sch) * 100).toFixed(2) : '0';
          return `For **${detectedLob}** on ${detectedDate}, absenteeism is **${absPerc}%** (${t.abs} agents absent out of ${t.sch} scheduled).`;
      }
      if (isAskingForIC) {
          const icPerc = t.req > 0 ? ((t.act / t.req) * 100).toFixed(2) : '100';
          return `For **${detectedLob}** on ${detectedDate}, IC (Interval Compliance) is **${icPerc}%**.`;
      }
      if (isAskingForHeadcount) {
          return `For **${detectedLob}** on ${detectedDate}, we had **${t.sch} agents scheduled**.`;
      }
  }

  // Interval specific reasoning
  if (detectedInterval) {
      const isPreviousMode = detectedInterval.startsWith("PREVIOUS_");
      const baseInterval = isPreviousMode ? detectedInterval.replace("PREVIOUS_", "") : detectedInterval;
      
      const lobData = dayData[targetLobKey];
      if (!lobData) return `I don't have data for ${detectedLob} on ${detectedDate}.`;
      
      let targetIndex = lobData.intervals.findIndex((i: any) => i.label === baseInterval);
      if (isPreviousMode) targetIndex = targetIndex > 0 ? targetIndex - 1 : -1;

      if (targetIndex === -1) return `I couldn't find the requested interval on ${detectedDate}.`;

      const targetInt = lobData.intervals[targetIndex];
      const prevInt = targetIndex > 0 ? lobData.intervals[targetIndex - 1] : null;

      const isShort = targetInt.lost > 0;
      const shortageMins = (targetInt.lost / 60).toFixed(1);
      
      let response = `**Interval Analysis: ${targetInt.label} (${detectedLob})**\n\n`;
      
      response += `**Current Situation:**\n`;
      if (isShort) {
          response += `At ${targetInt.label}, ${detectedLob} experienced a shortage of ${shortageMins} minutes. `;
          if (targetInt.req > 0) {
             response += `(Actual: ${(targetInt.act/60).toFixed(1)}m / Required: ${(targetInt.req/60).toFixed(1)}m).\n`;
          }
      } else {
          response += `At ${targetInt.label}, ${detectedLob} was properly staffed with an overage of ${(targetInt.over / 60).toFixed(1)} minutes.\n`;
      }

      if (prevInt || isPreviousMode) {
          response += `\n**What Changed:**\n`;
          if (prevInt) {
              const prevShort = prevInt.lost > 0;
              if (isShort && prevShort) {
                  const diff = ((targetInt.lost - prevInt.lost) / 60).toFixed(1);
                  if (parseFloat(diff) > 0) response += `The shortage worsened by ${diff} minutes compared to ${prevInt.label}.\n`;
                  else response += `The shortage improved by ${Math.abs(parseFloat(diff))} minutes compared to ${prevInt.label}.\n`;
              } else if (isShort && !prevShort) {
                  response += `Performance degraded. We dropped into a shortage from a healthy state at ${prevInt.label}.\n`;
              } else {
                  response += `Staffing remained stable compared to ${prevInt.label}.\n`;
              }
          }
      }

      if (isShort && targetInt.unactivities && targetInt.unactivities.length > 0) {
          response += `\n**Why It Is Happening:**\n`;
          const unactTotalSecs = targetInt.unactivities.reduce((acc: number, curr: any) => acc + curr.durSecs, 0);
          const unactMins = (unactTotalSecs / 60).toFixed(1);
          
          if (unactTotalSecs >= targetInt.lost) {
             response += `Based on the available data, unauthorized breaks are the primary driver. ${targetInt.unactivities.length} agents were on break, bleeding ${unactMins} minutes.\n`;
          } else {
             response += `The available data suggests unauthorized breaks contributed (${unactMins} mins), but the schedule itself was likely already tight.\n`;
          }
      }

      return response;
  }

  // Summary reasoning
  if (q.includes('summary') || q.includes('summarize') || q.includes('what is the current situation') || q.includes('what is happening') || q.includes("why is ic low") || q.includes("why ours is low")) {
      const t = dayData[targetLobKey];
      if (!t) return `No summary available for ${detectedLob} on ${detectedDate}.`;
      
      const absPerc = t.sch > 0 ? ((t.abs / t.sch) * 100).toFixed(2) : '0';
      const icPerc = t.req > 0 ? ((t.act / t.req) * 100).toFixed(2) : '100';
      const isBadAbs = parseFloat(absPerc) > 5;
      const isBadIc = parseFloat(icPerc) < 95;

      let response = `**Situation Summary (${detectedLob})**\n\n`;
      
      response += `**Current Situation:**\n`;
      response += `IC is currently at **${icPerc}%**. Absenteeism is **${absPerc}%**.\n\n`;
      
      response += `**Why It Is Happening:**\n`;
      if (isBadAbs && isBadIc) {
          response += `The available data shows high absenteeism (>5%), which appears to be a major contributor to the low IC.\n`;
      } else if (!isBadAbs && isBadIc) {
          response += `Attendance is normal, but IC is low. This suggests heavy internal shrinkage (unauthorized breaks) or inherently tight scheduling.\n`;
      } else {
          response += `Operations are running smoothly with IC and Attendance within normal bounds.\n`;
      }

      return response;
  }

  if (q.includes("hello") || q.includes("hi ") || q === "hi" || q.includes("hey")) {
      return "Hello! I am your Octopus Assistant. Ask me a general question or ask me to analyze the dashboard data!";
  }

  return "I don't have that information in the current dashboard data, but feel free to ask me to analyze a specific interval, summarize a date, or ask a general knowledge question!";
};
