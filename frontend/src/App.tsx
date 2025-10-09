import React from 'react'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { TransportBar } from "@/components/Transport"
import { PadGrid } from "@/components/PadGrid"
import { Sequencer } from "@/components/Sequencer"
import { PadPropertiesPanel } from "@/components/PadPropertiesPanel"
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
        <div className="flex min-h-svh flex-col">
          <SiteHeader />
          <main className="flex-1 space-y-4 p-4 pb-24">
            <div className="panel space-y-4">
              <PadGrid />
              <Sequencer />
              <PadPropertiesPanel />
            </div>
          </main>
          <TransportBar />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
