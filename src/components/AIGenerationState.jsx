import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

const messages = ['Analyzing your at-risk ingredients…', 'Finding ways to use what you already have…', 'Creating your rescue recipes…']

export default function AIGenerationState() {
  const [step, setStep] = useState(0)
  useEffect(() => { const timer = setInterval(() => setStep((current) => Math.min(current + 1, messages.length - 1)), 1800); return () => clearInterval(timer) }, [])
  return <div className="ai-loading" role="status"><span className="ai-orbit"><Sparkles size={20} /></span><div><strong>Preparing your rescue plan</strong><p>{messages[step]}</p></div><div className="ai-progress"><i style={{ width: `${(step + 1) / messages.length * 100}%` }} /></div></div>
}

