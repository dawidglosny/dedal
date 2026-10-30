/** A mocked analytics API — in a real project: your metrics service, a warehouse, a ticketing system. */
export type Metric = { label: string; value: string; delta?: string; trend?: 'up' | 'down' | 'flat' }
export type Ticket = { id: string; subject: string; status: string; age: string }

const delay = () => new Promise(resolve => setTimeout(resolve, 15))

export const analytics = {
  kpis: async (customer: string): Promise<Metric[]> => {
    await delay()
    return [
      { label: 'Revenue', value: customer === 'acme' ? '$48,210' : '$12,930', delta: '+8.1%', trend: 'up' },
      { label: 'Orders', value: customer === 'acme' ? '1,284' : '402', delta: '+3.4%', trend: 'up' },
      { label: 'Conversion', value: '2.7%', delta: '−0.2 pp', trend: 'down' },
      { label: 'Refunds', value: '17', delta: '0', trend: 'flat' },
    ]
  },
  ordersSeries: async (): Promise<number[]> => {
    await delay()
    return [32, 41, 38, 52, 49, 61, 58, 72, 69, 81, 77, 90]
  },
  tickets: async (): Promise<Ticket[]> => {
    await delay()
    return [
      { id: '#4812', subject: 'Invoice shows the wrong VAT rate', status: 'open', age: '2 h' },
      { id: '#4809', subject: 'Cannot export orders to CSV', status: 'pending', age: '5 h' },
      { id: '#4795', subject: 'Webhook retries stopped', status: 'open', age: '1 d' },
    ]
  },
  incidents: async (): Promise<string[]> => {
    await delay()
    throw new Error('status API: 503')
  },
}
