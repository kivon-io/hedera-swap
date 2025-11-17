"use client"
import { TABS } from "@/config/vault"
import { useVault } from "@/providers/VaultProvider"
import { ArrowRight } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"

const ProjectedEarnings = () => {
  const { activeTab, vault } = useVault()

  if (activeTab !== TABS.DEPOSIT) {
    return null
  }
  return (
    <Accordion
      type='single'
      collapsible
      className='w-full bg-white hover:no-underline rounded-lg border border-zinc-200'
    >
      <AccordionItem value='projected-earnings'>
        <AccordionTrigger className='hover:no-underline px-2'>
          <p>Projected Earnings</p>
        </AccordionTrigger>
        <AccordionContent className='flex flex-col gap-4 bg-zinc-100 rounded-lg p-2 border border-zinc-200 m-1'>
          {/* Show how much user will earn when they enter the amount they want to deposit */}
          <div className='flex flex-col gap-1'>
            <p className='text-sm text-muted-foreground font-medium'>Your Position</p>
            <div className='flex gap-2 items-center'>
              <p>0</p>
              <ArrowRight className='size-4' />
              <p>0 {vault.token.symbol}</p>
            </div>
          </div>
          <div className='flex flex-col gap-1'>
            <p className='text-sm text-muted-foreground font-medium'>Month</p>
            <div className='flex gap-2 items-center'>
              <p>0</p>
              <ArrowRight className='size-4' />
              <p>0 {vault.token.symbol}</p>
            </div>
          </div>
          <div className='flex flex-col gap-1'>
            <p className='text-sm text-muted-foreground font-medium'>Year</p>
            <div className='flex gap-2 items-center'>
              <p>0</p>
              <ArrowRight className='size-4' />
              <p>0 {vault.token.symbol}</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default ProjectedEarnings
