// profile setup tests
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileSetupPage } from './profile-setup.page';

describe('profile editor',()=>{
  const auth={ user:signal({ fullName:'Current Name',phoneNumber:'+639171234567',email:'owner@servio.test' }),avatarUrl:signal('https://storage.example/avatar'),settings:{ useMockApi:signal(false) },updateProfile:vi.fn(),landingPath:()=>'/tabs/home' };
  const router={ navigateByUrl:vi.fn().mockResolvedValue(true) };
  beforeEach(()=>{ vi.clearAllMocks(); auth.updateProfile.mockResolvedValue(undefined); TestBed.configureTestingModule({ providers:[ProfileSetupPage,{ provide:AuthService,useValue:auth },{ provide:ApiService,useValue:{} },{ provide:Router,useValue:router },{ provide:ActivatedRoute,useValue:{ snapshot:{ data:{ editing:true } } } }] }); });
  afterEach(()=>TestBed.resetTestingModule());
  it('prefills the signed-in identity, validates PH contact details and saves photo removal',async()=>{
    const editor=TestBed.inject(ProfileSetupPage);
    expect(editor.name()).toBe('Current Name'); editor.name.set('New Name'); editor.phone.set('09171234567'); await editor.save();
    expect(auth.updateProfile).not.toHaveBeenCalled();
    editor.phone.set('+639181234567'); editor.removePhoto(); await editor.save();
    expect(auth.updateProfile).toHaveBeenCalledWith('New Name','+639181234567',null);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/profile',{ replaceUrl:true });
  });
  it('keeps edits visible and stays on the editor when saving fails',async()=>{
    auth.updateProfile.mockRejectedValueOnce(new Error('Could not save'));
    const editor=TestBed.inject(ProfileSetupPage); editor.name.set('Keep This Name'); await editor.save();
    expect(editor.name()).toBe('Keep This Name'); expect(editor.error()).toBe('Could not save'); expect(router.navigateByUrl).not.toHaveBeenCalled(); expect(editor.saving()).toBe(false);
  });
});
