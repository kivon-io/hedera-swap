import VaultOverview from "@/components/vault/VaultOverview"
import VaultSidebar from "@/components/vault/VaultSidebar"
import { VaultProvider } from "@/providers/VaultProvider"


export default async function VaultDetailsPage({params,}: {
  params: Promise<{ address: string }>
}) {
  const { address } = await params
  return (
    <VaultProvider network={address}>
      <main className='relative 2xl:max-w-7xl w-full mx-auto'>
        <div className='grid grid-cols-12 gap-4'>
          <div className='col-span-12 lg:col-span-7'>
            <VaultOverview/>
          </div>
          <div className='col-span-12 lg:col-span-5'>
            <VaultSidebar />
          </div>
        </div>
      </main>
    </VaultProvider>
  )
}
