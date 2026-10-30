import {
  AspectRatio,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Grid,
  Heading,
  Inset,
  Link,
  Section,
  Separator,
  Tabs,
  Text,
} from '@radix-ui/themes'
import type { Registry } from 'dedal/react'
import type { Contract } from '../contract'
import { coverStyle, initials } from '../cover'

// translating neutral contract values to Radix Themes scales
const containerSize = { sm: '2', md: '3', lg: '4' } as const
const space = { sm: '2', md: '4', lg: '6' } as const
const ratio = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1 } as const
const badgeVariant = { default: 'solid', secondary: 'soft', outline: 'outline' } as const
const buttonVariant = { default: 'solid', secondary: 'soft', outline: 'outline', ghost: 'ghost' } as const
const titleSize = { sm: '3', md: '4', lg: '6' } as const

/**
 * Radix Themes registry: ready-made components from `@radix-ui/themes` (requires `<Theme>` in the layout).
 * Same contract as shadcn — different API, different scales, different look.
 */
export const radixThemes = {
  container: ({ size = 'lg', children }) => (
    <Container size={containerSize[size]} px="4">
      {children}
    </Container>
  ),

  section: ({ title, description, children }) => (
    <Section size="2">
      {(title || description) && (
        <Flex direction="column" gap="1" mb="5">
          {title && (
            <Heading as="h2" size="6">
              {title}
            </Heading>
          )}
          {description && <Text color="gray">{description}</Text>}
        </Flex>
      )}
      {children}
    </Section>
  ),

  grid: ({ columns = 3, gap = 'md', children }) => (
    <Grid columns={String(columns)} gap={space[gap]}>
      {children}
    </Grid>
  ),

  flex: ({ direction = 'row', gap = 'md', align = 'center', children }) => (
    <Flex direction={direction} gap={space[gap]} align={align}>
      {children}
    </Flex>
  ),

  hero: ({ title, description, href, media, actions }) => (
    <Card size="3">
      <Grid columns={{ initial: '1', md: '2' }} gap="6" align="center">
        <Box>{media}</Box>
        <Flex direction="column" gap="4">
          <Heading as="h1" size="8">
            <Link href={href} color="gray" highContrast underline="hover">
              {title}
            </Link>
          </Heading>
          {description && (
            <Text size="4" color="gray">
              {description}
            </Text>
          )}
          {actions && (
            <Flex gap="3" wrap="wrap">
              {actions}
            </Flex>
          )}
        </Flex>
      </Grid>
    </Card>
  ),

  // #region card
  card: ({ title, href, description, image, size = 'md', badge, footer }) => (
    <Card size="2" style={size === 'lg' ? { gridColumn: 'span 2' } : undefined}>
      <Flex direction="column" gap="3">
        {image && size !== 'sm' && (
          <Inset clip="padding-box" side="top" pb="current">
            <AspectRatio ratio={4 / 3}>
              <Box width="100%" height="100%" style={coverStyle(image)} />
            </AspectRatio>
          </Inset>
        )}
        {badge && <Box>{badge}</Box>}
        <Heading as="h3" size={titleSize[size]}>
          <Link href={href} color="gray" highContrast underline="hover">
            {title}
          </Link>
        </Heading>
        {description && size !== 'sm' && (
          <Text size="2" color="gray">
            {description}
          </Text>
        )}
        {footer}
      </Flex>
    </Card>
  ),
  // #endregion

  badge: ({ label, variant = 'default' }) => <Badge variant={badgeVariant[variant]}>{label}</Badge>,

  avatar: ({ name, src }) => (
    <Flex gap="2" align="center">
      <Avatar size="1" radius="full" src={src} fallback={initials(name)} />
      <Text size="2" color="gray">
        {name}
      </Text>
    </Flex>
  ),

  button: ({ label, href, variant = 'default' }) =>
    href ? (
      <Button asChild variant={buttonVariant[variant]} size="3">
        <a href={href}>{label}</a>
      </Button>
    ) : (
      <Button variant={buttonVariant[variant]} size="3">
        {label}
      </Button>
    ),

  image: ({ src, alt, ratio: r = '16:9' }) => (
    <AspectRatio ratio={ratio[r]}>
      <Box role="img" aria-label={alt} width="100%" height="100%" style={{ ...coverStyle(src), borderRadius: 'var(--radius-3)' }} />
    </AspectRatio>
  ),

  tabs: ({ labels, content = [] }) => (
    <Tabs.Root defaultValue={labels[0]}>
      <Tabs.List>
        {labels.map(label => (
          <Tabs.Trigger key={label} value={label}>
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Box pt="3">
        {labels.map((label, index) => (
          <Tabs.Content key={label} value={label}>
            {content[index]}
          </Tabs.Content>
        ))}
      </Box>
    </Tabs.Root>
  ),

  list: ({ items = [] }) => (
    <Flex asChild direction="column" gap="2">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map(item => (
          <li key={item.href}>
            <Link href={item.href} weight="medium">
              {item.title}
            </Link>
            {item.meta && (
              <Text size="2" color="gray">
                {' '}
                · {item.meta}
              </Text>
            )}
          </li>
        ))}
      </ul>
    </Flex>
  ),

  separator: () => <Separator size="4" my="4" />,
} satisfies Registry<Contract>
