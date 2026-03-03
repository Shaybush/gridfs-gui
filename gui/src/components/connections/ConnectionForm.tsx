import { useEffect, useState } from 'react'
import { Loader2, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@src/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@src/components/ui/dialog'
import { Input } from '@src/components/ui/input'
import { Label } from '@src/components/ui/label'
import { Switch } from '@src/components/ui/switch'
import type { Connection, ConnectionCreate, ConnectionUpdate } from '@src/types/connection'

interface ConnectionFormBaseProps {
  onClose: () => void
}

interface CreateModeProps extends ConnectionFormBaseProps {
  mode: 'create'
  onSubmit: (data: ConnectionCreate) => Promise<Connection>
  defaultValues?: undefined
}

interface EditModeProps extends ConnectionFormBaseProps {
  mode: 'edit'
  onSubmit: (data: ConnectionUpdate) => Promise<Connection>
  defaultValues: Connection
}

type ConnectionFormProps = CreateModeProps | EditModeProps

interface FormState {
  name: string
  uri: string
  tls: boolean
}

interface FormErrors {
  name?: string
  uri?: string
}

function validate(values: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!values.name.trim()) errors.name = 'Name is required'
  if (!values.uri.trim()) errors.uri = 'URI is required'
  return errors
}

export function ConnectionForm(props: ConnectionFormProps) {
  const { mode, onSubmit, onClose } = props
  const defaultValues = mode === 'edit' ? props.defaultValues : undefined

  const [values, setValues] = useState<FormState>({
    name: defaultValues?.name ?? '',
    uri: '',
    tls: defaultValues?.tls ?? false,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (mode === 'edit' && defaultValues) {
      setValues({
        name: defaultValues.name,
        uri: '',
        tls: defaultValues.tls,
      })
    }
  }, [mode, defaultValues?.id])

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        const payload: ConnectionCreate = {
          name: values.name.trim(),
          uri: values.uri.trim(),
          tls: values.tls,
        }
        await (onSubmit as (data: ConnectionCreate) => Promise<Connection>)(payload)
        toast.success('Connection created')
      } else {
        const payload: ConnectionUpdate = {
          name: values.name.trim(),
          tls: values.tls,
          ...(values.uri.trim() ? { uri: values.uri.trim() } : {}),
        }
        await (onSubmit as (data: ConnectionUpdate) => Promise<Connection>)(payload)
        toast.success('Connection updated')
      }
      onClose()
    } catch (err: any) {
      const message = err?.message ?? 'Something went wrong'
      toast.error(`Failed to ${mode === 'create' ? 'create' : 'update'} connection: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {mode === 'create' ? 'Add Connection' : 'Edit Connection'}
        </DialogTitle>
        <DialogDescription>
          {mode === 'create'
            ? 'Connect to a MongoDB instance or Atlas cluster.'
            : 'Update the connection details. Leave URI blank to keep the existing one.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conn-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="conn-name"
            placeholder="My MongoDB"
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            aria-invalid={Boolean(errors.name)}
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name}</p>
          )}
        </div>

        {/* URI */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conn-uri">
            URI{mode === 'create' && <span className="text-destructive"> *</span>}
            {mode === 'edit' && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">(leave blank to keep current)</span>
            )}
          </Label>
          <Input
            id="conn-uri"
            placeholder="mongodb://localhost:27017"
            value={values.uri}
            onChange={(e) => handleChange('uri', e.target.value)}
            aria-invalid={Boolean(errors.uri)}
            disabled={isSubmitting}
            autoComplete="off"
          />
          {errors.uri && (
            <p className="text-xs text-destructive">{errors.uri}</p>
          )}
        </div>

        {/* TLS toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">TLS / SSL</p>
              <p className="text-xs text-muted-foreground">Enable encrypted connection</p>
            </div>
          </div>
          <Switch
            checked={values.tls}
            onCheckedChange={(checked) => handleChange('tls', checked)}
            disabled={isSubmitting}
            aria-label="Enable TLS"
          />
        </div>

        <DialogFooter showCloseButton>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {mode === 'create' ? 'Add Connection' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
