import { useEffect, useState } from 'react'
import TipsMarquee from '../../components/TipsMarquee'
import SiteHeader from '../../components/SiteHeader'
import SiteFooter from '../../components/SiteFooter'
import PublicNav from '../../components/PublicNav'
import RecordLookup from '../../components/RecordLookup'
import { getActiveTips } from '../../lib/api'
import type { Tip } from '../../lib/types'

export default function FindRecord() {
  const [tips, setTips] = useState<Tip[]>([])

  useEffect(() => {
    getActiveTips().then(setTips).catch(() => setTips([]))
  }, [])

  return (
    <div className="app-shell">
      <SiteHeader />
      <TipsMarquee tips={tips} />
      <main className="page page--narrow">
        <PublicNav />
        <RecordLookup title="Find my record / Dod o hyd i fy nghofnod" />
      </main>
      <SiteFooter />
    </div>
  )
}
