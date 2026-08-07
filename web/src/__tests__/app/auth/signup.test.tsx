import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import SignUpPage from '@/app/auth/signup/page'

// Mock next/navigation
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>
  }
})

// Mock PageTransition
jest.mock('@/components/PageTransition', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock sonner toast
jest.mock('sonner', () => {
  return {
    toast: {
      success: jest.fn(),
      error: jest.fn(),
    },
  }
})

// Mock Supabase client
const mockSignUp = jest.fn()
const mockSignInWithOAuth = jest.fn()

jest.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
    },
  }),
}))

describe('SignUp Page', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    jest.clearAllMocks()

    // Default successful signup response
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' }, session: { access_token: 'token' } },
      error: null,
    })

    mockSignInWithOAuth.mockResolvedValue({
      data: {},
      error: null,
    })
  })

  describe('Page Rendering', () => {
    it('should render sign up form with all fields', () => {
      render(<SignUpPage />)

      expect(screen.getByRole('heading', { name: /join tossup/i })).toBeInTheDocument()
      // CardTitle renders as div with data-slot="card-title"
      expect(screen.getByText('Create account', { selector: '[data-slot="card-title"]' })).toBeInTheDocument()

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()

      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument()
    })

    it('should have proper form structure and labels', () => {
      render(<SignUpPage />)

      expect(screen.getByText(/enter your information to get started/i)).toBeInTheDocument()
    })

    it('should show link to sign in page', () => {
      render(<SignUpPage />)

      const signInLink = screen.getByRole('link', { name: /sign in/i })
      expect(signInLink).toBeInTheDocument()
      expect(signInLink).toHaveAttribute('href', '/auth/signin')
    })
  })

  describe('Form Validation', () => {
    it('should show error for whitespace-only name field', async () => {
      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      // Fill name with whitespace - passes HTML5 required but fails trim() check
      await user.type(nameInput, '   ')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
      })

      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should require email input', () => {
      render(<SignUpPage />)

      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toBeRequired()
      expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('should show error for short password', async () => {
      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, '123')
      await user.type(confirmPasswordInput, '123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
      })

      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('should show error for mismatched passwords', async () => {
      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'different123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })

      expect(mockSignUp).not.toHaveBeenCalled()
    })
  })

  describe('Password Visibility Toggle', () => {
    it('should toggle password visibility', async () => {
      render(<SignUpPage />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      // Find the toggle button next to the password field (not confirm password)
      const passwordContainer = passwordInput.closest('.relative')!
      const toggleButton = passwordContainer.querySelector('button')!

      expect(passwordInput).toHaveAttribute('type', 'password')

      await user.click(toggleButton)
      expect(passwordInput).toHaveAttribute('type', 'text')

      await user.click(toggleButton)
      expect(passwordInput).toHaveAttribute('type', 'password')
    })

    it('should toggle confirm password visibility', async () => {
      render(<SignUpPage />)

      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const confirmContainer = confirmPasswordInput.closest('.relative')!
      const toggleButton = confirmContainer.querySelector('button')!

      expect(confirmPasswordInput).toHaveAttribute('type', 'password')

      await user.click(toggleButton)
      expect(confirmPasswordInput).toHaveAttribute('type', 'text')

      await user.click(toggleButton)
      expect(confirmPasswordInput).toHaveAttribute('type', 'password')
    })
  })

  describe('Successful Sign Up', () => {
    it('should handle successful sign up with email verification', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: { id: 'user-123' }, session: null },
        error: null,
      })

      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: {
            data: { name: 'John Doe' },
            emailRedirectTo: `${location.origin}/auth/callback`
          }
        })
      })

      expect(screen.getByText('Please check your email for a verification link before signing in.')).toBeInTheDocument()
    })

    it('should handle successful sign up with immediate session', async () => {
      mockSignUp.mockResolvedValue({
        data: {
          user: { id: 'user-123' },
          session: { access_token: 'token' }
        },
        error: null,
      })

      // Get the mocked toast
      const { toast: mockToast } = jest.requireMock('sonner')

      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith('Account created successfully!')
        // Phase F: legacy /dashboard retired → land on the platform home feed.
        expect(mockPush).toHaveBeenCalledWith('/home')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display Supabase auth errors', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' },
      })

      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument()
      })
    })

    it('should handle unexpected errors', async () => {
      mockSignUp.mockRejectedValue(new Error('Network error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Google Sign Up', () => {
    it('should initiate Google OAuth sign up', async () => {
      render(<SignUpPage />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/auth/callback`
        }
      })
    })

    it('should handle Google OAuth errors', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        data: {},
        error: { message: 'OAuth error' },
      })

      render(<SignUpPage />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      await waitFor(() => {
        expect(screen.getByText('OAuth error')).toBeInTheDocument()
      })
    })

    it('should handle Google OAuth network errors', async () => {
      mockSignInWithOAuth.mockRejectedValue(new Error('Network error'))

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      render(<SignUpPage />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to sign up with Google')).toBeInTheDocument()
      })

      consoleSpy.mockRestore()
    })
  })

  describe('Loading States', () => {
    it('should show loading state during form submission', async () => {
      mockSignUp.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: { user: null }, error: null }), 100))
      )

      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'password123')
      await user.click(submitButton)

      expect(screen.getByText('Creating account...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })

    it('should disable buttons during Google OAuth', async () => {
      mockSignInWithOAuth.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 100))
      )

      render(<SignUpPage />)

      const googleButton = screen.getByRole('button', { name: /continue with google/i })
      await user.click(googleButton)

      expect(googleButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labeling', () => {
      render(<SignUpPage />)

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    })

    it('should have proper heading hierarchy', () => {
      render(<SignUpPage />)

      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    })

    it('should have accessible form validation', async () => {
      render(<SignUpPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      // Fill all fields but with mismatched passwords to trigger error
      await user.type(nameInput, 'John Doe')
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.type(confirmPasswordInput, 'different123')
      await user.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })
    })
  })
})
