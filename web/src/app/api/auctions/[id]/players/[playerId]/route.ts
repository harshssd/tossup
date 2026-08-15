import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{
    id: string
    playerId: string
  }>
}

const updatePlayerSchema = z.object({
  name: z.string().min(1, 'Player name is required').optional(),
  playingRole: z.string().optional(), // Accept comma-separated roles as string
  customTags: z.string().optional(),
  tierId: z.string().optional(),
})

// PUT - Update individual player
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()

    const { id: auctionId, playerId } = await params
    const body = await request.json()

    // Validate request body
    const validatedData = updatePlayerSchema.parse(body)

    // Get authenticated user
    const { userId } = getAuthenticatedUser(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if auction exists and user has permission
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        *,
        participations:auction_participations!auction_id(role)
      `)
      .eq('id', auctionId)
      .eq('auction_participations.user_id', userId)
      .maybeSingle()

    if (auctionError) {
      throw auctionError
    }

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      )
    }

    // Check if user has permission (auction owner or participant with appropriate role)
    const userParticipant = auction.participations?.[0]
    const canManage = auction.owner_id === userId ||
                     (userParticipant && ['OWNER', 'MODERATOR', 'CAPTAIN'].includes(userParticipant.role))

    if (!canManage) {
      return NextResponse.json(
        { error: 'Permission denied - insufficient privileges to edit players' },
        { status: 403 }
      )
    }

    // Only allow editing in DRAFT status
    if (auction.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Players can only be edited in DRAFT status' },
        { status: 400 }
      )
    }

    // Check if player exists and belongs to this auction
    const { data: existingPlayer, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('auction_id', auctionId)
      .maybeSingle()

    if (playerError) {
      throw playerError
    }

    if (!existingPlayer) {
      return NextResponse.json(
        { error: 'Player not found in this auction' },
        { status: 404 }
      )
    }

    // Validate tier if provided
    if (validatedData.tierId) {
      const { data: tier, error: tierError } = await supabase
        .from('tiers')
        .select('*')
        .eq('id', validatedData.tierId)
        .eq('auction_id', auctionId)
        .maybeSingle()

      if (tierError) {
        throw tierError
      }

      if (!tier) {
        return NextResponse.json(
          { error: 'Invalid tier ID for this auction' },
          { status: 400 }
        )
      }
    }

    // Handle multiple playing roles - store the first role in playingRole field
    // and store all roles in customTags for backward compatibility
    const updateData: any = {}

    if (validatedData.playingRole) {
      const roles = validatedData.playingRole.split(',').map(r => r.trim()).filter(r => r)
      const validRoles = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKETKEEPER']

      // Validate all roles are valid
      const invalidRoles = roles.filter(role => !validRoles.includes(role))
      if (invalidRoles.length > 0) {
        return NextResponse.json(
          { error: 'Invalid playing roles', details: { invalidRoles } },
          { status: 400 }
        )
      }

      if (roles.length > 0) {
        // Store primary role in playing_role field
        updateData.playing_role = roles[0]

        // Store all roles in custom_tags as comma-separated string
        const existingTags = validatedData.customTags || existingPlayer.custom_tags || ''
        const roleString = roles.join(',')

        // If we have existing custom tags that aren't roles, preserve them
        const existingNonRoleTags = existingTags.split(',')
          .map((t: string) => t.trim())
          .filter((t: string) => t && !validRoles.includes(t))
          .join(',')

        updateData.custom_tags = existingNonRoleTags
          ? `${roleString},${existingNonRoleTags}`
          : roleString
      }
    }

    // Add other fields to update
    if (validatedData.name) updateData.name = validatedData.name
    if (validatedData.tierId) updateData.tier_id = validatedData.tierId
    if (validatedData.customTags !== undefined && !validatedData.playingRole) {
      updateData.custom_tags = validatedData.customTags
    }

    // Update the player
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update(updateData)
      .eq('id', playerId)
      .select(`
        *,
        tier:tiers!tier_id(id, name, base_price, color),
        auction_results(team:teams(id, name))
      `)
      .single()

    if (updateError) {
      throw updateError
    }

    // Transform auction_results → assigned_team for backward compat
    const { auction_results: ar, ...playerRest } = updatedPlayer as any
    const assigned_team = ar?.[0]?.team ?? null

    return NextResponse.json({
      success: true,
      message: `Player ${updatedPlayer.name} updated successfully`,
      player: { ...playerRest, assigned_team }
    })

  } catch (error) {
    console.error('Failed to update player:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to update player',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET - Get individual player details
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()

    const { id: auctionId, playerId } = await params

    const { data: player, error } = await supabase
      .from('players')
      .select(`
        *,
        tier:tiers!tier_id(id, name, base_price, color),
        auction_results(team:teams(id, name))
      `)
      .eq('id', playerId)
      .eq('auction_id', auctionId)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found in this auction' },
        { status: 404 }
      )
    }

    // Transform auction_results → assigned_team for backward compat
    const { auction_results: ar2, ...playerData } = player as any
    const assigned_team2 = ar2?.[0]?.team ?? null

    return NextResponse.json({
      success: true,
      player: { ...playerData, assigned_team: assigned_team2 }
    })

  } catch (error) {
    console.error('Failed to get player:', error)
    return NextResponse.json(
      { error: 'Failed to get player details' },
      { status: 500 }
    )
  }
}

// DELETE - Delete individual player
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const supabase = await createClient()

    const { id: auctionId, playerId } = await params

    // Get authenticated user
    const { userId } = getAuthenticatedUser(request)

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if auction exists and user has permission
    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select(`
        *,
        participations:auction_participations!auction_id(role)
      `)
      .eq('id', auctionId)
      .eq('auction_participations.user_id', userId)
      .maybeSingle()

    if (auctionError) {
      throw auctionError
    }

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      )
    }

    // Check permission
    const userParticipant = auction.participations?.[0]
    const canManage = auction.owner_id === userId ||
                     (userParticipant && ['OWNER', 'MODERATOR', 'CAPTAIN'].includes(userParticipant.role))

    if (!canManage) {
      return NextResponse.json(
        { error: 'Permission denied - insufficient privileges to delete players' },
        { status: 403 }
      )
    }

    // Only allow deletion in DRAFT status
    if (auction.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Players can only be deleted in DRAFT status' },
        { status: 400 }
      )
    }

    // Check if player exists and belongs to this auction
    const { data: existingPlayer, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('auction_id', auctionId)
      .maybeSingle()

    if (playerError) {
      throw playerError
    }

    if (!existingPlayer) {
      return NextResponse.json(
        { error: 'Player not found in this auction' },
        { status: 404 }
      )
    }

    // Delete the player
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: `Player ${existingPlayer.name} deleted successfully`
    })

  } catch (error) {
    console.error('Failed to delete player:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete player',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
