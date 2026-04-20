UPDATE public.role_permissions
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"data_loggers": true}'::jsonb,
    updated_at = now()
WHERE role_key = 'admin';