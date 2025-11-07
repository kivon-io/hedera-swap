import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion"

// TODO: All the fees and rates should be shown here

const FeeAndRate = () => {
  return (
    <Accordion type='single' collapsible className='w-full'>
      <AccordionItem value='fee-and-rate'>
        <AccordionTrigger className='hover:no-underline'>
          <p className='text-xs'>1 ETH = 1000 USD</p>
        </AccordionTrigger>
        <AccordionContent className='flex flex-col gap-2 bg-white rounded-2xl p-4 border border-zinc-200'>
          <FeeItem label='Conversion Rate' value='1 ETH = 1000 USD' />
          <FeeItem label='Protocol fee' value='4% (0.0004 ETH)' />
          <FeeItem label='Est. Total Received' value='4% (0.0004 ETH)' />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export default FeeAndRate

const FeeItem = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className='flex justify-between items-center'>
      <p className='text-sm'>{label}</p>
      <p className='text-sm'>{value}</p>
    </div>
  )
}
