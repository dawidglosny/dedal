import { Badge, Callout, Card, Flex, Grid, Heading, Table, Text } from '@radix-ui/themes'
import type { Registry } from 'dedal/react'
import type { DashboardContract } from './contract'

const trendColor = { up: 'green', down: 'red', flat: 'gray' } as const

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const path = points.map((p, i) => `${(i / (points.length - 1)) * 100},${36 - ((p - min) / (max - min || 1)) * 32}`).join(' ')
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" width="100%" height="64" aria-hidden>
      <polyline points={path} fill="none" stroke="var(--accent-9)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** The dashboard registry: widgets built from Radix Themes. */
export const dashboardRegistry = {
  board: ({ title, columns = 4, children }) => (
    <Flex direction="column" gap="3" my="4">
      {title && (
        <Heading as="h2" size="4">
          {title}
        </Heading>
      )}
      <Grid columns={{ initial: '1', sm: String(columns) }} gap="3">
        {children}
      </Grid>
    </Flex>
  ),

  panel: ({ title, span = 1, children }) => (
    <Card size="2" style={span === 2 ? { gridColumn: 'span 2' } : undefined}>
      <Flex direction="column" gap="2">
        {title && (
          <Text size="2" weight="bold" color="gray">
            {title}
          </Text>
        )}
        {children}
      </Flex>
    </Card>
  ),

  stat: ({ label, value, delta, trend = 'flat' }) => (
    <Card size="2">
      <Flex direction="column" gap="1">
        <Text size="2" color="gray">
          {label}
        </Text>
        <Text size="7" weight="bold">
          {value}
        </Text>
        {delta && (
          <Badge color={trendColor[trend]} variant="soft" style={{ alignSelf: 'start' }}>
            {delta}
          </Badge>
        )}
      </Flex>
    </Card>
  ),

  chart: ({ label, points = [] }) => (
    <Flex direction="column" gap="1">
      <Text size="2" color="gray">
        {label}
      </Text>
      {points.length > 1 && <Sparkline points={points} />}
    </Flex>
  ),

  table: ({ columns = [], rows = [] }) => (
    <Table.Root size="1">
      <Table.Header>
        <Table.Row>
          {columns.map(column => (
            <Table.ColumnHeaderCell key={column}>{column}</Table.ColumnHeaderCell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map(row => (
          <Table.Row key={row[0]}>
            {row.map((cell, i) => (
              <Table.Cell key={i}>{cell}</Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  ),

  alert: ({ text, tone = 'info' }) => (
    <Callout.Root color={tone === 'warning' ? 'amber' : 'blue'} size="1">
      <Callout.Text>{text}</Callout.Text>
    </Callout.Root>
  ),
} satisfies Registry<DashboardContract>
