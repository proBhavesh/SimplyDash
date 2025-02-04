import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import React from 'react'

const ResponsiveBar = dynamic(() => import('@nivo/bar').then(mod => mod.ResponsiveBar), { ssr: false })
const ResponsiveLine = dynamic(() => import('@nivo/line').then(mod => mod.ResponsiveLine), { ssr: false })

const AssistantDetail: React.FC = () => {
  const router = useRouter()
  const { id } = router.query

  const data = [
    { country: 'AD', 'hot dog': 137, 'hot dogColor': 'hsl(229, 70%, 50%)' },
    { country: 'AE', 'hot dog': 55, 'hot dogColor': 'hsl(296, 70%, 50%)' },
    { country: 'AF', 'hot dog': 109, 'hot dogColor': 'hsl(78, 70%, 50%)' },
    { country: 'AG', 'hot dog': 133, 'hot dogColor': 'hsl(217, 70%, 50%)' },
    { country: 'AI', 'hot dog': 81, 'hot dogColor': 'hsl(190, 70%, 50%)' },
  ]

  return (
    <div>
      <h1>Assistant Detail</h1>
      <p>Assistant ID: {id}</p>
      {/* Add your charts here */}
      <div style={{ height: '400px' }}>
        <ResponsiveBar
          data={data}
          keys={['hot dog']}
          indexBy="country"
          margin={{ top: 50, right: 130, bottom: 50, left: 60 }}
          padding={0.3}
          valueScale={{ type: 'linear' }}
          indexScale={{ type: 'band', round: true }}
          colors={{ scheme: 'nivo' }}
          borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'country',
            legendPosition: 'middle',
            legendOffset: 32
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'food',
            legendPosition: 'middle',
            legendOffset: -40
          }}
          labelSkipWidth={12}
          labelSkipHeight={12}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
          legends={[
            {
              dataFrom: 'keys',
              anchor: 'bottom-right',
              direction: 'column',
              justify: false,
              translateX: 120,
              translateY: 0,
              itemsSpacing: 2,
              itemWidth: 100,
              itemHeight: 20,
              itemDirection: 'left-to-right',
              itemOpacity: 0.85,
              symbolSize: 20,
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemOpacity: 1
                  }
                }
              ]
            }
          ]}
        />
      </div>
    </div>
  )
}

export default AssistantDetail