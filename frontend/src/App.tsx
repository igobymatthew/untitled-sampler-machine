import React from 'react'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TransportBar } from "@/components/Transport"
import { PadGrid } from "@/components/PadGrid"
import { Sequencer } from "@/components/Sequencer"
import { SampleRecorder } from "@/components/SampleRecorder"
import { DemoProjectLoader } from "@/components/DemoProjectLoader"
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar"


export default function App() {
  return (
    <SidebarProvider>
      <DemoProjectLoader />
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="app p-4">
          <div className="panel">
            <TransportBar />
            <hr style={{borderColor:'#1f242b', margin:'12px 0'}} />
            <SampleRecorder />
          </div>
          <div className="panel">
            <PadGrid />
            <div style={{height:12}} />
            <Sequencer />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
