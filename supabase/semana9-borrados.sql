-- Semana 9 · C1: borrado lógico. La fila queda como "lápida" para que los demás teléfonos se enteren.
-- Ejecutar DESPUÉS de semana9.sql. El trigger de server_updated_at ya cubre los UPDATE que marcan
-- deleted_at, así que la lápida llega a los demás teléfonos por el cursor de bajada.
alter table public.photos add column deleted_at timestamptz;
