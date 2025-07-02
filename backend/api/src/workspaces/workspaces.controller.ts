import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceMemberRole } from './entities/workspace-member.entity';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  async findAll(@Request() req) {
    return this.workspacesService.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.workspacesService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    updateData: { name?: string; description?: string; logoUrl?: string },
    @Request() req,
  ) {
    return this.workspacesService.update(id, req.user.id, updateData);
  }

  @Post(':id/switch')
  async switchWorkspace(@Param('id') id: string, @Request() req) {
    await this.workspacesService.switchWorkspace(req.user.id, id);
    return { message: 'Workspace switched successfully' };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req) {
    await this.workspacesService.delete(id, req.user.id);
    return { message: 'Workspace deleted successfully' };
  }

  // Team management endpoints
  @Get(':id/members')
  async getMembers(@Param('id') id: string, @Request() req) {
    return this.workspacesService.getMembers(id, req.user.id);
  }

  @Post(':id/members/invite')
  async inviteMember(
    @Param('id') id: string,
    @Body() inviteData: { email: string; role?: WorkspaceMemberRole },
    @Request() req,
  ) {
    return this.workspacesService.inviteMember(
      id,
      req.user.id,
      inviteData.email,
      inviteData.role || WorkspaceMemberRole.MEMBER,
    );
  }

  @Post('accept-invite')
  async acceptInvite(@Query('token') token: string, @Request() req) {
    await this.workspacesService.acceptInvite(token, req.user.id);
    return { message: 'Invite accepted successfully' };
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Request() req,
  ) {
    await this.workspacesService.removeMember(id, req.user.id, memberId);
    return { message: 'Member removed successfully' };
  }

  @Patch(':id/members/:memberId/role')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateData: { role: WorkspaceMemberRole },
    @Request() req,
  ) {
    await this.workspacesService.updateMemberRole(
      id,
      req.user.id,
      memberId,
      updateData.role,
    );
    return { message: 'Member role updated successfully' };
  }
}
